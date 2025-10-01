(() => {
	const STORAGE_KEY = 'quicknotes.v1.notes';
	const DRAFT_KEY = 'quicknotes.v1.draft';

	const noteInput = document.getElementById('noteInput');
	const saveBtn = document.getElementById('saveBtn');
	const expandBtn = document.getElementById('expandBtn');
	const statusEl = document.getElementById('status');
	const notesList = document.getElementById('notesList');
	const exportBtn = document.getElementById('exportBtn');
	const importInput = document.getElementById('importInput');
	const typeButtons = Array.from(document.querySelectorAll('.type-btn'));

	let currentType = 'note';
	let notes = [];
	let undoStack = [];
	let showAll = false;

	function load() {
		try {
			notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
		} catch (_) { notes = []; }
		renderNotes();
		noteInput.value = localStorage.getItem(DRAFT_KEY) || '';
		setType(localStorage.getItem('quicknotes.v1.type') || 'note');
	}

	function persist() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
	}

	function setType(type) {
		currentType = type;
		typeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === type)));
		localStorage.setItem('quicknotes.v1.type', type);
	}

	function addNote(text) {
		const trimmed = text.trim();
		if (!trimmed) return;
		const note = { id: crypto.randomUUID(), type: currentType, text: trimmed, ts: Date.now() };
		notes.unshift(note);
		persist();
		renderNotes();
		announce('Saved');
	}

	function updateNote(id, newText) {
		const idx = notes.findIndex(n => n.id === id);
		if (idx === -1) return;
		notes[idx] = { ...notes[idx], text: newText };
		persist();
		renderNotes();
	}

	function deleteNote(id) {
		const idx = notes.findIndex(n => n.id === id);
		if (idx === -1) return;
		const [removed] = notes.splice(idx, 1);
		undoStack.push(removed);
		persist();
		renderNotes();
		announce('Deleted. Click Undo to restore.');
	}

	function undoDelete() {
		const item = undoStack.pop();
		if (!item) return;
		notes.unshift(item);
		persist();
		renderNotes();
		announce('Restored');
	}

	function createNoteElement(note) {
		const li = document.createElement('li');
		li.className = 'note-item';
		li.dataset.id = note.id;

		const pill = document.createElement('span');
		pill.className = `note-pill pill-${note.type}`;
		pill.textContent = note.type;

		const content = document.createElement('div');
		const textEl = document.createElement('div');
		textEl.className = 'note-text';
		textEl.textContent = note.text;
		const meta = document.createElement('div');
		meta.className = 'note-meta';
		meta.textContent = new Date(note.ts).toLocaleString();
		content.appendChild(textEl);
		content.appendChild(meta);

		const actions = document.createElement('div');
		actions.className = 'note-actions';
		const editBtn = document.createElement('button');
		editBtn.textContent = 'Edit';
		const delBtn = document.createElement('button');
		delBtn.textContent = 'Delete';
		const undoBtn = document.createElement('button');
		undoBtn.textContent = 'Undo';
		actions.appendChild(editBtn);
		actions.appendChild(delBtn);
		actions.appendChild(undoBtn);

		editBtn.addEventListener('click', () => beginInlineEdit(li, note));
		delBtn.addEventListener('click', () => deleteNote(note.id));
		undoBtn.addEventListener('click', () => undoDelete());

		li.appendChild(pill);
		li.appendChild(content);
		li.appendChild(actions);
		return li;
	}

	function beginInlineEdit(li, note) {
		const content = li.children[1];
		const actions = li.children[2];
		content.innerHTML = '';
		const ta = document.createElement('textarea');
		ta.value = note.text;
		ta.rows = Math.min(8, Math.max(3, Math.ceil(note.text.length / 60)));
		content.appendChild(ta);
		const meta = document.createElement('div');
		meta.className = 'note-meta';
		meta.textContent = 'Editing… Enter to save, Esc to cancel';
		content.appendChild(meta);

		actions.innerHTML = '';
		const save = document.createElement('button');
		save.textContent = 'Save';
		const cancel = document.createElement('button');
		cancel.textContent = 'Cancel';
		actions.appendChild(save);
		actions.appendChild(cancel);

		const commit = () => updateNote(note.id, ta.value.trim());
		const revert = () => renderNotes();

		save.addEventListener('click', commit);
		cancel.addEventListener('click', revert);
		ta.addEventListener('keydown', e => {
			if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
			if (e.key === 'Escape') { e.preventDefault(); revert(); }
		});
		setTimeout(() => ta.focus(), 0);
	}

	function renderNotes() {
		notesList.innerHTML = '';
		const visibleNotes = showAll ? notes : notes.slice(0, 3);
		visibleNotes.forEach(n => notesList.appendChild(createNoteElement(n)));

		// Remove existing toggle if any
		const existingToggle = document.getElementById('notesToggle');
		if (existingToggle && existingToggle.parentElement) {
			existingToggle.parentElement.removeChild(existingToggle);
		}

		// Add View more/View less control when applicable
		if (notes.length > 3) {
			const toggle = document.createElement('button');
			toggle.id = 'notesToggle';
			toggle.textContent = showAll ? 'View less' : 'View more';
			toggle.setAttribute('aria-expanded', String(showAll));
			toggle.style.marginTop = '8px';
			toggle.style.border = '1px solid var(--border)';
			toggle.style.background = 'white';
			toggle.style.padding = '6px 10px';
			toggle.style.borderRadius = '8px';
			toggle.addEventListener('click', () => {
				showAll = !showAll;
				renderNotes();
			});
			// Insert after the list
			notesList.parentElement.appendChild(toggle);
		}
	}

	function announce(msg) {
		statusEl.textContent = msg;
		setTimeout(() => { if (statusEl.textContent === msg) statusEl.textContent = ''; }, 1500);
	}

	// Events
		noteInput.addEventListener('input', () => {
			localStorage.setItem(DRAFT_KEY, noteInput.value);
		});

		saveBtn.addEventListener('click', () => {
			addNote(noteInput.value);
			noteInput.value = '';
			localStorage.removeItem(DRAFT_KEY);
			noteInput.focus();
		});

		noteInput.addEventListener('keydown', (e) => {
			// Cmd+Enter toggles expand
			if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
				e.preventDefault();
				noteInput.classList.toggle('expanded');
				announce(noteInput.classList.contains('expanded') ? 'Expanded' : 'Collapsed');
				return;
			}
			// Enter to save (no modifiers)
			if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
				e.preventDefault();
				saveBtn.click();
			}
		});

		expandBtn.addEventListener('click', () => {
			noteInput.classList.toggle('expanded');
			announce(noteInput.classList.contains('expanded') ? 'Expanded' : 'Collapsed');
		});

		typeButtons.forEach(btn => btn.addEventListener('click', () => setType(btn.dataset.type)));

		document.addEventListener('keydown', (e) => {
			if (e.target instanceof HTMLTextAreaElement) return;
			if (e.key === '1') setType('charter');
			if (e.key === '2') setType('idea');
			if (e.key === '3') setType('bug');
			if (e.key === '4') setType('note');
		});

		exportBtn.addEventListener('click', () => {
			const data = JSON.stringify({ version: 1, notes }, null, 2);
			const blob = new Blob([data], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `quicknotes-${new Date().toISOString().slice(0,19)}.json`;
			a.click();
			URL.revokeObjectURL(url);
		});

		importInput.addEventListener('change', async () => {
			const file = importInput.files && importInput.files[0];
			if (!file) return;
			try {
				const text = await file.text();
				const payload = JSON.parse(text);
				if (!Array.isArray(payload.notes)) throw new Error('Invalid file');
				notes = payload.notes.concat(notes);
				persist();
				renderNotes();
				announce('Imported');
			} catch (err) {
				announce('Import failed');
			}
			importInput.value = '';
		});

	// Init
	load();
})();



