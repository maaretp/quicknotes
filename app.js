(() => {
	const STORAGE_KEY = 'quicknotes.v1.notes';
	const DRAFT_KEY = 'quicknotes.v1.draft';
	const CONFIG_KEY = 'quicknotes.v1.config';

	const noteInput = document.getElementById('noteInput');
	const saveBtn = document.getElementById('saveBtn');
	const expandBtn = document.getElementById('expandBtn');
	const statusEl = document.getElementById('status');
	const notesList = document.getElementById('notesList');
	const exportBtn = document.getElementById('exportBtn');
	const importInput = document.getElementById('importInput');
	const typeSwitcher = document.getElementById('typeSwitcher');
	const configBtn = document.getElementById('configBtn');
	const configDialog = document.getElementById('configDialog');
	const configTextarea = document.getElementById('configTextarea');
	const configSaveBtn = document.getElementById('configSaveBtn');
	const configCancelBtn = document.getElementById('configCancelBtn');

	// Timer elements
	const timerDisplay = document.getElementById('timerDisplay');
	const timerPauseBtn = document.getElementById('timerPauseBtn');
	const graphBars = document.getElementById('graphBars');

	let currentType = 'note';
	let notes = [];
	let showAll = false;
	let categories = [];

	// Timer state
	let timerInterval = null;
	let timerStartEpoch = null; // ms timestamp when current run segment started
	let elapsedMs = 0; // accumulated elapsed time
	let isRunning = false;
	let activeTimerCategory = null; // key of category used to attribute current run
	let perCategoryMs = {}; // { [key]: ms }

	function formatHMS(totalMs) {
		const totalSeconds = Math.floor(totalMs / 1000);
		const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
		const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
		const s = String(totalSeconds % 60).padStart(2, '0');
		return `${h}:${m}:${s}`;
	}

	function updateTimerDisplay() {
		const base = elapsedMs + (isRunning && timerStartEpoch ? (Date.now() - timerStartEpoch) : 0);
		timerDisplay.textContent = formatHMS(base);
	}

	function updateGraph() {
		// Build list of timer categories only
		const timerCats = categories.filter(c => c.startsTimer);
		const data = timerCats.map(c => ({ key: c.key, label: c.label, color: c.color, ms: Number(perCategoryMs[c.key] || 0) }));
		const max = Math.max(1, ...data.map(d => d.ms));
		graphBars.innerHTML = '';
		data.forEach(d => {
			const row = document.createElement('div');
			row.className = 'graph__row';
			const label = document.createElement('div');
			label.className = 'graph__label';
			label.textContent = d.label;
			const bar = document.createElement('div');
			bar.className = 'graph__bar';
			const fill = document.createElement('div');
			fill.className = 'graph__fill';
			fill.style.width = `${Math.round((d.ms / max) * 100)}%`;
			fill.style.background = d.color;
			bar.appendChild(fill);
			const value = document.createElement('div');
			value.className = 'graph__value';
			value.textContent = formatHMS(d.ms);
			row.appendChild(label);
			row.appendChild(bar);
			row.appendChild(value);
			graphBars.appendChild(row);
		});
	}

	function startTimer() {
		if (isRunning) return;
		isRunning = true;
		timerStartEpoch = Date.now();
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = setInterval(updateTimerDisplay, 250);
		updateTimerDisplay();
	}

	function pauseTimer() {
		if (!isRunning) return;
		const delta = Date.now() - (timerStartEpoch || Date.now());
		elapsedMs += delta;
		if (activeTimerCategory) {
			perCategoryMs[activeTimerCategory] = (perCategoryMs[activeTimerCategory] || 0) + delta;
			savePerCategory();
			updateGraph();
		}
		isRunning = false;
		timerStartEpoch = null;
		if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
		updateTimerDisplay();
	}

	// resetTimer removed

	function saveTimerState() {
		const payload = { elapsedMs: elapsedMs + (isRunning && timerStartEpoch ? (Date.now() - timerStartEpoch) : 0), isRunning: isRunning };
		localStorage.setItem('quicknotes.v1.timer', JSON.stringify(payload));
	}
	function savePerCategory() {
		localStorage.setItem('quicknotes.v1.perCategory', JSON.stringify(perCategoryMs));
		localStorage.setItem('quicknotes.v1.activeCategory', activeTimerCategory || '');
	}

	function loadPerCategory() {
		try {
			perCategoryMs = JSON.parse(localStorage.getItem('quicknotes.v1.perCategory') || '{}');
		} catch (_) { perCategoryMs = {}; }
		activeTimerCategory = localStorage.getItem('quicknotes.v1.activeCategory') || null;
	}

	function loadTimerState() {
		try {
			const raw = localStorage.getItem('quicknotes.v1.timer');
			if (!raw) return;
			const state = JSON.parse(raw);
			elapsedMs = Number(state.elapsedMs) || 0;
			if (state.isRunning) {
				// Resume as running from now (not exact persistence but good UX)
				isRunning = true;
				timerStartEpoch = Date.now();
				timerInterval = setInterval(updateTimerDisplay, 250);
			}
			updateTimerDisplay();
		} catch (_) {}
	}

	window.addEventListener('beforeunload', saveTimerState);

	function load() {
		try {
			notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
		} catch (_) { notes = []; }
		loadConfig();
		renderNotes();
		noteInput.value = localStorage.getItem(DRAFT_KEY) || '';
		setType(localStorage.getItem('quicknotes.v1.type') || (categories[0]?.key || 'note'));
		loadPerCategory();
		loadTimerState();
		updateGraph();
	}

	function persist() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
	}

	function defaultConfig() {
		return {
			version: 1,
			categories: [
				{ key: 'test', label: 'Test', color: '#d8b4fe', startsTimer: true, hotkey: 1 },
				{ key: 'setup', label: 'Setup', color: '#a7f3d0', startsTimer: true, hotkey: 2 },
				{ key: 'bug', label: 'Bug', color: '#fecaca', startsTimer: true, hotkey: 3 },
				{ key: 'charter', label: 'Charter', color: '#dbeafe', startsTimer: false, hotkey: 4 },
				{ key: 'future', label: 'Future', color: '#bae6fd', startsTimer: false },
				{ key: 'idea', label: 'Idea', color: '#fde68a', startsTimer: false, hotkey: 5 },
				{ key: 'question', label: 'Question', color: '#fbcfe8', startsTimer: false },
				{ key: 'automate', label: 'Automate', color: '#e9d5ff', startsTimer: false },
				{ key: 'document', label: 'Document', color: '#cffafe', startsTimer: false },
				{ key: 'note', label: 'Note', color: '#fff7ed', startsTimer: false, hotkey: 6 }
			]
		};
	}

	function loadConfig() {
		try {
			const raw = localStorage.getItem(CONFIG_KEY);
			const conf = raw ? JSON.parse(raw) : defaultConfig();
			if (!Array.isArray(conf.categories)) throw new Error('Invalid config');
			categories = conf.categories;
		} catch (_) {
			categories = defaultConfig().categories;
		}
		renderTypeButtons();
	}

	function saveConfig() {
		const conf = { version: 1, categories };
		localStorage.setItem(CONFIG_KEY, JSON.stringify(conf));
	}

	function renderTypeButtons() {
		typeSwitcher.innerHTML = '';
		const timers = categories.filter(c => c.startsTimer);
		const nonTimers = categories.filter(c => !c.startsTimer);

		const makeGroup = (label, items) => {
			const group = document.createElement('div');
			group.className = 'type-group';
			const groupLabel = document.createElement('span');
			groupLabel.className = 'type-group__label';
			groupLabel.textContent = label;
			group.appendChild(groupLabel);
			items.forEach(cat => {
				const btn = document.createElement('button');
				btn.className = 'type-btn';
				btn.dataset.type = cat.key;
				btn.setAttribute('aria-pressed', String(cat.key === currentType));
				btn.title = `${cat.label}${cat.hotkey ? ` (${cat.hotkey})` : ''}`;
				btn.textContent = cat.label;
				btn.style.background = cat.color;
				btn.addEventListener('click', () => setType(cat.key));
				group.appendChild(btn);
			});
			return group;
		};

		if (timers.length) typeSwitcher.appendChild(makeGroup('Timer', timers));
		if (nonTimers.length) typeSwitcher.appendChild(makeGroup('Other', nonTimers));
	}

	function getCategoryByKey(key) {
		return categories.find(c => c.key === key);
	}

	function setType(type) {
		currentType = type;
		Array.from(typeSwitcher.querySelectorAll('.type-btn')).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === type)));
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
		const cat = getCategoryByKey(note.type);
		if (cat && cat.startsTimer) {
			if (isRunning) pauseTimer();
			activeTimerCategory = cat.key;
			savePerCategory();
			startTimer();
		}
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
		notes.splice(idx, 1);
		persist();
		renderNotes();
		announce('Deleted');
	}

	// Undo functionality removed

	function createNoteElement(note) {
		const li = document.createElement('li');
		li.className = 'note-item';
		li.dataset.id = note.id;

		const pill = document.createElement('span');
		pill.className = 'note-pill';
		pill.textContent = (getCategoryByKey(note.type)?.label || note.type);
		const color = getCategoryByKey(note.type)?.color;
		if (color) pill.style.background = color;

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
		actions.appendChild(editBtn);
		actions.appendChild(delBtn);


		editBtn.addEventListener('click', () => beginInlineEdit(li, note));
		delBtn.addEventListener('click', () => deleteNote(note.id));

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


		// Timer controls
		timerPauseBtn.addEventListener('click', () => pauseTimer());

		// Config dialog
		configBtn.addEventListener('click', () => {
			configTextarea.value = JSON.stringify({ categories }, null, 2);
			configDialog.showModal();
		});
		configCancelBtn.addEventListener('click', () => {
			configDialog.close();
		});
		configSaveBtn.addEventListener('click', (e) => {
			e.preventDefault();
			try {
				const parsed = JSON.parse(configTextarea.value);
				if (!parsed || !Array.isArray(parsed.categories)) throw new Error('Invalid format');
				categories = parsed.categories;
				saveConfig();
				renderTypeButtons();
				announce('Categories saved');
				configDialog.close();
			} catch (_) {
				announce('Invalid categories JSON');
			}
		});

		document.addEventListener('keydown', (e) => {
			if (e.target instanceof HTMLTextAreaElement) return;
			// Hotkeys for categories (number keys)
			if (/^[0-9]$/.test(e.key)) {
				const num = Number(e.key);
				const match = categories.find(c => c.hotkey === num);
				if (match) setType(match.key);
			}
		// Space toggles pause/resume when not in textarea
			if (e.code === 'Space') {
				e.preventDefault();
				if (isRunning) pauseTimer(); else startTimer();
			}
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



