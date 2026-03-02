// ============================================================
// ✅ CONFIGURA AQUÍ TUS CREDENCIALES DE SUPABASE
// ============================================================
const SUPABASE_URL = 'https://crvkwzuekncypkrocgik.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydmt3enVla25jeXBrcm9jZ2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzg1MzksImV4cCI6MjA4Nzk1NDUzOX0.0WQLYqGGuaYiqfkVYxKkFFqtvpw58Sqa8BtDhmpIg0Y'
// ============================================================

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

// ============================================================
// ✅ HELPERS DE ZONA HORARIA
//    El input datetime-local devuelve "2026-03-02T09:00" (sin zona)
//    Supabase lo interpreta como UTC, causando +6/-6 horas de diferencia
//    Solución: convertir a UTC al GUARDAR, y a local al LEER
// ============================================================

// Al LEER de Supabase: UTC → hora local para mostrar en el input
function toLocalInputFormat(utcString) {
    const date = new Date(utcString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Al GUARDAR en Supabase: hora local → UTC ISO string
function toUTC(localDateString) {
    if (!localDateString) return null
    return new Date(localDateString).toISOString()
}

// ============================================================
// ✅ FUNCIONES DE AUTH (llamadas desde el HTML)
// ============================================================

function setAuthMessage(text, type = 'error') {
    const el = document.getElementById('auth-msg')
    el.textContent = text
    el.className = `auth-message ${type}`
}

function switchTab(tab) {
    document.getElementById('form-login').style.display = tab === 'login' ? 'block' : 'none'
    document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none'
    document.getElementById('tab-login').classList.toggle('active', tab === 'login')
    document.getElementById('tab-register').classList.toggle('active', tab === 'register')
    setAuthMessage('')
}

async function login() {
    const email = document.getElementById('login-email').value.trim()
    const password = document.getElementById('login-password').value
    if (!email || !password) return setAuthMessage('Please fill in all fields.')
    const { error } = await db.auth.signInWithPassword({ email, password })
    if (error) setAuthMessage(error.message)
}

async function register() {
    const email = document.getElementById('reg-email').value.trim()
    const password = document.getElementById('reg-password').value
    if (!email || !password) return setAuthMessage('Please fill in all fields.')
    const { error } = await db.auth.signUp({ email, password })
    if (error) {
        setAuthMessage(error.message)
    } else {
        setAuthMessage('✅ Check your email to confirm your account, then sign in.', 'success')
    }
}

async function loginWithGoogle() {
    const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
    })
    if (error) setAuthMessage(error.message)
}

async function loginWithGitHub() {
    const { error } = await db.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.href }
    })
    if (error) setAuthMessage(error.message)
}

async function logout() {
    await db.auth.signOut()
}

// ============================================================
// ✅ MOSTRAR / OCULTAR OVERLAY
// ============================================================

function showApp(user) {
    document.getElementById('auth-overlay').classList.add('hidden')
    document.getElementById('user-bar').style.display = 'flex'
    document.getElementById('user-email-label').textContent = user.email
}

function showAuth() {
    document.getElementById('auth-overlay').classList.remove('hidden')
    document.getElementById('user-bar').style.display = 'none'
}

function showSync() {
    const el = document.getElementById('sync-indicator')
    el.classList.add('visible')
    clearTimeout(el._timer)
    el._timer = setTimeout(() => el.classList.remove('visible'), 1500)
}

// ============================================================
// ✅ APP PRINCIPAL
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

    // Inicializar auth
    db.auth.getSession().then(({ data: { session } }) => {
        if (session) showApp(session.user)
        else showAuth()
    })

    db.auth.onAuthStateChange((_event, session) => {
        if (session) {
            showApp(session.user)
            loadFromSupabase()
        } else {
            showAuth()
            todos = []
            renderTodos()
            updateStats()
        }
    })

    // DOM Elements
    const form = document.getElementById('todo-form');
    const input = document.getElementById('todo-input');
    const descInput = document.getElementById('todo-desc');
    const datetimeInput = document.getElementById('todo-datetime');
    const todoList = document.getElementById('todo-list');
    const emptyState = document.getElementById('empty-state');
    const taskStats = document.getElementById('task-stats');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const clearCompletedBtn = document.getElementById('clear-completed');
    const themeSelect = document.getElementById('theme-select');
    const todoReminder = document.getElementById('todo-reminder');
    const countAllSpan = document.getElementById('count-all');
    const countActiveSpan = document.getElementById('count-active');
    const countCompletedSpan = document.getElementById('count-completed');
    const countExpiredSpan = document.getElementById('count-expired');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const editTitle = document.getElementById('edit-title');
    const editDesc = document.getElementById('edit-desc');
    const editDatetime = document.getElementById('edit-datetime');
    const editReminder = document.getElementById('edit-reminder');
    const cancelEditBtn = document.getElementById('cancel-edit');
    let currentlyEditingId = null;

    // State
    let todos = [];
    let currentFilter = 'all';

    // Theme
    const savedTheme = localStorage.getItem('theme') || 'default';
    themeSelect.value = savedTheme;
    applyTheme(savedTheme);

    setMinDateForInputs();

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
    setInterval(checkAlerts, 30000);

    renderTodos();
    updateStats();

    // ============================================================
    // ✅ CRUD CON SUPABASE
    // ============================================================

    async function loadFromSupabase() {
        const { data: { user } } = await db.auth.getUser()
        if (!user) return

        const { data, error } = await db
            .from('todos')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) { console.error('Error loading todos:', error); return }

        todos = data.map(row => ({
            id: row.id,
            text: row.text,
            description: row.description || '',
            // ✅ Al LEER: convertir UTC → hora local
            dueDate: row.due_date ? toLocalInputFormat(row.due_date) : null,
            reminderMins: row.reminder_mins ?? 5,
            notified: row.notified ?? false,
            completed: row.is_complete ?? false,
            createdAt: row.created_at
        }))

        renderTodos()
        updateStats()
    }

    async function saveToSupabase(todo) {
        showSync()
        const { data: { user } } = await db.auth.getUser()
        const { data, error } = await db.from('todos').insert({
            user_id: user.id,
            text: todo.text,
            description: todo.description,
            // ✅ Al GUARDAR: convertir hora local → UTC
            due_date: toUTC(todo.dueDate),
            reminder_mins: todo.reminderMins,
            notified: todo.notified,
            is_complete: todo.completed
        }).select().single()

        if (error) {
            console.error('Error saving todo:', error)
            return null
        }
        return data
    }

    async function updateInSupabase(id, changes) {
        showSync()
        const dbChanges = {}
        if ('completed' in changes) dbChanges.is_complete = changes.completed
        if ('notified' in changes) dbChanges.notified = changes.notified
        if ('text' in changes) dbChanges.text = changes.text
        if ('description' in changes) dbChanges.description = changes.description
        // ✅ Al ACTUALIZAR: también convertir hora local → UTC
        if ('dueDate' in changes) dbChanges.due_date = toUTC(changes.dueDate)
        if ('reminderMins' in changes) dbChanges.reminder_mins = changes.reminderMins
        const { error } = await db.from('todos').update(dbChanges).eq('id', id)
        if (error) console.error('Error updating todo:', error)
    }

    async function deleteFromSupabase(id) {
        showSync()
        const { error } = await db.from('todos').delete().eq('id', id)
        if (error) console.error('Error deleting todo:', error)
    }

    function saveAndRender() {
        renderTodos()
        updateStats()
    }

    // =============== Event Listeners ===============

    themeSelect.addEventListener('change', (e) => {
        const theme = e.target.value;
        applyTheme(theme);
        localStorage.setItem('theme', theme);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        const description = descInput.value.trim();
        const dueDate = datetimeInput.value;
        const reminderMins = todoReminder.value;

        if (text) {
            addTodo(text, description, dueDate, reminderMins);
            input.value = '';
            descInput.value = '';
            datetimeInput.value = '';
            todoReminder.value = '5';
        }
    });

    todoList.addEventListener('click', (e) => {
        const item = e.target.closest('.todo-item');
        if (!item) return;
        const id = item.dataset.id;

        if (e.target.closest('.delete-btn')) {
            deleteTodo(id, item);
        } else if (e.target.closest('.edit-btn')) {
            openEditModal(id);
        } else if (e.target.tagName !== 'INPUT' && !e.target.classList.contains('checkmark')) {
            toggleTodo(id);
        }
    });

    todoList.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const item = e.target.closest('.todo-item');
            if (item) toggleTodo(item.dataset.id, e.target.checked);
        }
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTodos();
        });
    });

    clearCompletedBtn.addEventListener('click', () => {
        const completedItems = todoList.querySelectorAll('.todo-item.completed');
        let removedCount = 0;
        completedItems.forEach(item => { item.classList.add('deleting'); removedCount++; });

        if (removedCount > 0) {
            setTimeout(async () => {
                const completedIds = todos.filter(t => t.completed).map(t => t.id)
                todos = todos.filter(todo => !todo.completed);
                saveAndRender();
                for (const id of completedIds) await deleteFromSupabase(id)
            }, 300);
        }
    });

    cancelEditBtn.addEventListener('click', closeEditModal);

    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (currentlyEditingId) {
            saveEdit(currentlyEditingId, editTitle.value.trim(), editDesc.value.trim(), editDatetime.value, editReminder.value);
        }
    });

    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModal();
    });

    // =============== Functions ===============

    function applyTheme(theme) {
        if (theme === 'default') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    function setMinDateForInputs() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const str = `${year}-${month}-${day}T${hours}:${minutes}`;
        datetimeInput.setAttribute('min', str);
        editDatetime.setAttribute('min', str);
    }

    datetimeInput.addEventListener('focus', setMinDateForInputs);
    editDatetime.addEventListener('focus', setMinDateForInputs);

    function isTaskExpired(todo) {
        if (todo.completed || !todo.dueDate) return false;
        return new Date(todo.dueDate).getTime() <= new Date().getTime();
    }

    function checkAlerts() {
        if (!todos.length) return;
        const now = new Date();
        let needsRender = false;

        todos.forEach(todo => {
            if (todo.completed || !todo.dueDate) return;
            const dueTime = new Date(todo.dueDate).getTime();
            const currentTime = now.getTime();

            if (!todo.notified) {
                const notifyTime = dueTime - (todo.reminderMins * 60000);
                if (currentTime >= notifyTime && currentTime < dueTime) {
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("JECR Task Reminder", {
                            body: `Your task "${todo.text}" is due soon!`,
                            icon: "/favicon.ico"
                        });
                    }
                    todo.notified = true;
                    updateInSupabase(todo.id, { notified: true })
                    needsRender = true;
                }
            }
            if (currentTime >= dueTime) needsRender = true;
        });

        if (needsRender) saveAndRender();
    }

    async function addTodo(text, description, dueDate, reminderMins) {
        const tempId = 'temp-' + Date.now().toString();
        const newTodo = {
            id: tempId,
            text,
            description: description || '',
            dueDate: dueDate || null,
            reminderMins: parseInt(reminderMins, 10),
            notified: false,
            completed: false,
            createdAt: new Date().toISOString()
        };
        todos.unshift(newTodo);
        saveAndRender();

        const savedData = await saveToSupabase(newTodo);
        if (savedData) {
            const index = todos.findIndex(t => t.id === tempId);
            if (index !== -1) {
                todos[index].id = savedData.id;
                todos[index].createdAt = savedData.created_at;
                saveAndRender();
            }
        } else {
            todos = todos.filter(t => t.id !== tempId);
            saveAndRender();
            alert("Hubo un error al guardar la tarea en la nube.");
        }
    }

    function toggleTodo(id, forcedState = null) {
        todos = todos.map(todo => {
            if (todo.id === id) {
                const updated = { ...todo, completed: forcedState !== null ? forcedState : !todo.completed }
                updateInSupabase(id, { completed: updated.completed })
                return updated
            }
            return todo;
        });
        saveAndRender();
    }

    function deleteTodo(id, element) {
        element.classList.add('deleting');
        setTimeout(() => {
            todos = todos.filter(todo => todo.id !== id);
            saveAndRender();
            deleteFromSupabase(id)
        }, 300);
    }

    function openEditModal(id) {
        const todo = todos.find(t => t.id === id);
        if (!todo) return;
        currentlyEditingId = id;
        editTitle.value = todo.text;
        editDesc.value = todo.description || '';
        editDatetime.value = todo.dueDate || '';
        editReminder.value = todo.reminderMins !== undefined ? todo.reminderMins : '5';
        editModal.classList.add('active');
        editTitle.focus();
    }

    function closeEditModal() {
        editModal.classList.remove('active');
        currentlyEditingId = null;
    }

    function saveEdit(id, newText, newDesc, newDueDate, newReminder) {
        if (!newText) return;
        todos = todos.map(todo => {
            if (todo.id === id) {
                const resetNotify = (todo.dueDate !== newDueDate) || (todo.reminderMins !== parseInt(newReminder, 10));
                const updated = {
                    ...todo,
                    text: newText,
                    description: newDesc,
                    dueDate: newDueDate || null,
                    reminderMins: parseInt(newReminder, 10),
                    notified: resetNotify ? false : todo.notified
                };
                updateInSupabase(id, {
                    text: updated.text,
                    description: updated.description,
                    dueDate: updated.dueDate,
                    reminderMins: updated.reminderMins,
                    notified: updated.notified
                })
                return updated
            }
            return todo;
        });
        closeEditModal();
        saveAndRender();
    }

    function getFilteredTodos() {
        switch (currentFilter) {
            case 'active': return todos.filter(t => !t.completed && !isTaskExpired(t));
            case 'completed': return todos.filter(t => t.completed);
            case 'expired': return todos.filter(t => !t.completed && isTaskExpired(t));
            default: return todos;
        }
    }

    function renderTodos() {
        const filteredTodos = getFilteredTodos();
        if (filteredTodos.length === 0) {
            todoList.innerHTML = '';
            emptyState.classList.add('visible');
            return;
        }
        emptyState.classList.remove('visible');
        todoList.innerHTML = filteredTodos.map(todo => {
            let formattedDate = '';
            if (todo.dueDate) {
                const dateObj = new Date(todo.dueDate);
                const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                formattedDate = `<span class="todo-date-tag"><i class="fa-regular fa-clock"></i> ${dateStr} at ${timeStr}</span>`;
            }
            const isExpired = isTaskExpired(todo);
            const statusClass = todo.completed ? 'completed' : (isExpired ? 'expired' : '');
            return `
                <li class="todo-item ${statusClass}" data-id="${todo.id}">
                    <label class="checkbox-container">
                        <input type="checkbox" ${todo.completed ? 'checked' : ''} tabindex="-1">
                        <span class="checkmark"></span>
                    </label>
                    <div class="todo-content">
                        <span class="todo-text">${escapeHTML(todo.text)}</span>
                        ${todo.description ? `<span class="todo-desc-text">${escapeHTML(todo.description)}</span>` : ''}
                        ${formattedDate}
                    </div>
                    <div class="todo-actions">
                        <button class="action-btn edit-btn" aria-label="Edit task">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="action-btn delete-btn" aria-label="Delete task">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </li>
            `;
        }).join('');
    }

    function updateStats() {
        const remaining = todos.filter(t => !t.completed && !isTaskExpired(t)).length;
        const expired = todos.filter(t => !t.completed && isTaskExpired(t)).length;
        const completed = todos.filter(t => t.completed).length;
        const total = todos.length;

        countAllSpan.textContent = `(${total})`;
        countActiveSpan.textContent = `(${remaining})`;
        countCompletedSpan.textContent = `(${completed})`;
        countExpiredSpan.textContent = `(${expired})`;

        if (todos.length === 0) {
            taskStats.textContent = "Start adding some tasks!";
        } else if (remaining === 0 && expired === 0) {
            taskStats.textContent = "All tasks completed! 🎉";
        } else {
            let text = `${remaining} task${remaining !== 1 ? 's' : ''} remaining`;
            if (expired > 0) text += ` (${expired} expired)`;
            taskStats.textContent = text;
        }

        const hasCompleted = todos.some(t => t.completed);
        clearCompletedBtn.style.opacity = hasCompleted ? '1' : '0.5';
        clearCompletedBtn.style.pointerEvents = hasCompleted ? 'auto' : 'none';
        clearCompletedBtn.disabled = !hasCompleted;
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});