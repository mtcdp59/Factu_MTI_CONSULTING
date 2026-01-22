import {
    getCurrentDate,
    getTasks,
    getIsSyncing,
    setIsSyncing,
    getIsGoogleSignedIn,
    getFullCalendarInstance,
    setFullCalendarInstance,
    setCurrentView,
    setCurrentDate,
    getCurrentView
} from './config.js';
import {
    initGoogleAuth,
    updateSignInStatus
} from './auth.js';
import {
    formatDate,
    getWeekDates
} from './date-utils.js';
import {
    getEventColor
} from './event.js';
import {
    showToast
} from './toast.js';
import {
    openEventForm,
    closeEventForm
} from './event.js';


// Sync version - reads from CONFIG (already loaded at startup)
export function getConfiguredCalendarId() {
    // Check if stored value is in CONFIG first (from initial load)
    return CONFIG.CALENDAR_ID;
}

// Async version for saving
export async function setConfiguredCalendarId(calendarId) {
    await storageManager.saveDual('mti_calendar_id', calendarId);
    CONFIG.CALENDAR_ID = calendarId;
}

export function renderDayView() {
    // Always render to appCalendarContainer (app's own calendar views)
    const container = document.getElementById('appCalendarContainer');
    if (!container) return;
    const dateStr = formatDate(getCurrentDate());
    const dayTasks = getTasks().filter(task => task.date === dateStr);

    const timeSlots = [];
    for (let h = 8; h <= 18; h++) {
        for (let m = 0; m < 60; m += 30) {
            if (h === 18 && m > 0) break;
            timeSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
    }

    let html = '<div style="border: 1px solid var(--color-card-border); border-radius: var(--radius-base); overflow: hidden;">';

    timeSlots.forEach(slot => {
        const tasksAtTime = dayTasks.filter(task => task.startTime === slot);
        html += `<div style="display: flex; border-bottom: 1px solid var(--color-card-border);">`;
        html += `<div style="width: 80px; padding: var(--space-8); background-color: var(--color-bg-1); font-weight: var(--font-weight-medium); font-size: var(--font-size-sm);">${slot}</div>`;
        html += `<div style="flex: 1; padding: var(--space-8); min-height: 40px;">`;

        tasksAtTime.forEach(task => {
            const color = task.type === 'Travail' ? 'var(--color-primary)' : task.type === 'Réunion client' ? '#3B82F6' : 'var(--color-slate-500)';
            html += `<div style="background-color: rgba(var(--color-teal-500-rgb), 0.1); border-left: 3px solid ${color}; padding: var(--space-6); border-radius: var(--radius-sm); margin-bottom: var(--space-4); cursor: pointer;" onclick="editTask(${getTasks().indexOf(task)})">`;
            html += `<strong>${task.description}</strong> (${task.duration}h)`;
            html += `</div>`;
        });

        html += `</div></div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

export function renderWeekView() {
    // Always render to appCalendarContainer (app's own calendar views)
    const container = document.getElementById('appCalendarContainer');
    if (!container) return;
    const weekDates = getWeekDates(getCurrentDate());
    const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

    let html = '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--space-8);">';

    weekDates.forEach((date, index) => {
        const dateStr = formatDate(date);
        const dayTasks = getTasks().filter(task => task.date === dateStr);
        const isToday = formatDate(new Date()) === dateStr;

        html += `<div style="border: 1px solid var(--color-card-border); border-radius: var(--radius-base); padding: var(--space-12); min-height: 200px; background-color: var(--color-surface); ${isToday ? 'box-shadow: 0 0 0 2px var(--color-primary);' : ''}">`;
        html += `<div style="font-weight: var(--font-weight-semibold); margin-bottom: var(--space-8); padding-bottom: var(--space-8); border-bottom: 1px solid var(--color-card-border); font-size: var(--font-size-sm);">${daysOfWeek[index]}<br><span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${date.getDate()}/${date.getMonth()+1}</span></div>`;

        dayTasks.forEach(task => {
            const color = task.type === 'Travail' ? 'var(--color-primary)' : task.type === 'Réunion client' ? '#3B82F6' : 'var(--color-slate-500)';
            html += `<div style="background-color: rgba(var(--color-teal-500-rgb), 0.1); border-left: 3px solid ${color}; padding: var(--space-6); border-radius: var(--radius-sm); margin-bottom: var(--space-6); font-size: var(--font-size-xs); cursor: pointer;" onclick="editTask(${getTasks().indexOf(task)})">`;
            html += `<div style="font-weight: var(--font-weight-semibold); color: var(--color-text);">${task.startTime} (${task.duration}h)</div>`;
            html += `<div style="color: var(--color-text-secondary); font-size: var(--font-size-xs);">${task.description}</div>`;
            html += `</div>`;
        });

        html += `</div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

export function renderMonthView() {
    // Always render to appCalendarContainer (app's own calendar views)
    const container = document.getElementById('appCalendarContainer');
    if (!container) return;
    const year = getCurrentDate().getFullYear();
    const month = getCurrentDate().getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const daysInMonth = lastDay.getDate();

    let html = '<div style="border: 1px solid var(--color-card-border); border-radius: var(--radius-base); overflow: hidden;">';

    // Header
    html += '<div style="display: grid; grid-template-columns: repeat(7, 1fr); background-color: var(--color-bg-1);">';
    ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach(day => {
        html += `<div style="padding: var(--space-8); text-align: center; font-weight: var(--font-weight-semibold); font-size: var(--font-size-sm);">${day}</div>`;
    });
    html += '</div>';

    // Days
    html += '<div style="display: grid; grid-template-columns: repeat(7, 1fr);">';

    for (let i = 0; i < firstDayOfWeek; i++) {
        html += '<div style="padding: var(--space-8); min-height: 80px; border: 1px solid var(--color-card-border); background-color: var(--color-secondary);"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDate(date);
        const dayTasks = getTasks().filter(task => task.date === dateStr);
        const isToday = formatDate(new Date()) === dateStr;
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

        html += `<div style="padding: var(--space-8); min-height: 80px; border: 1px solid var(--color-card-border); cursor: pointer; ${isToday ? 'background-color: rgba(var(--color-teal-500-rgb), 0.1); font-weight: var(--font-weight-bold);' : ''} ${isWeekend ? 'background-color: var(--color-secondary);' : ''}" onclick="showDayTasks('${dateStr}')">`;
        html += `<div style="font-size: var(--font-size-sm); margin-bottom: var(--space-4);">${day}</div>`;

        if (dayTasks.length > 0) {
            dayTasks.slice(0, 2).forEach(task => {
                const color = task.type === 'Travail' ? 'var(--color-primary)' : task.type === 'Réunion client' ? '#3B82F6' : 'var(--color-slate-500)';
                html += `<div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; display: inline-block; margin-right: var(--space-4);"></div>`;
            });
            if (dayTasks.length > 2) {
                html += `<span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">+${dayTasks.length - 2}</span>`;
            }
        }

        html += '</div>';
    }

    html += '</div></div>';
    container.innerHTML = html;
}

// --- Calendar Manager UI & actions ---
export function initCalendarManager() {
    const container = document.getElementById('calendarEmbedContainer');
    if (!container) return;

    // Manager panel will be inserted below the iframe
    let manager = document.getElementById('calendarManager');
    if (manager) return; // already initialized

    manager = document.createElement('div');
    manager.id = 'calendarManager';
    manager.style.marginTop = '12px';
    manager.innerHTML = `
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
            <label style="font-size:13px; color:var(--color-text-secondary);">Gérer les RDV</label>
            <input type="date" id="mgrStartDate" class="form-control" style="width:160px;" />
            <input type="date" id="mgrEndDate" class="form-control" style="width:160px;" />
            <button class="btn btn-sm btn-primary" id="mgrLoadEvents">Charger</button>
            <button class="btn btn-sm btn-secondary" id="mgrNewEvent">Nouvel RDV</button>
        </div>
        <div id="mgrEventsList" style="max-height:260px; overflow:auto; border:1px solid var(--color-card-border); padding:8px; border-radius:6px; background:#fff;"></div>
        <div id="mgrEventForm" style="display:none; margin-top:8px; border:1px solid var(--color-card-border); padding:12px; border-radius:6px; background:#fff;">
            <div style="display:flex; gap:8px; margin-bottom:8px;"><input type="date" id="evtDate" class="form-control" style="width:160px;" /><input type="time" id="evtTime" class="form-control" style="width:120px;" /><input type="number" id="evtDuration" class="form-control" style="width:100px;" value="1" step="0.5" /></div>
            <input type="text" id="evtDesc" class="form-control" placeholder="Titre / description" style="margin-bottom:8px;" />
            <select id="evtType" class="form-control" style="margin-bottom:8px;"><option value="Travail">Travail</option><option value="Réunion">Réunion</option><option value="Administratif">Administratif</option></select>
            <div style="display:flex; gap:8px; justify-content:flex-end;"><button class="btn btn-secondary" id="evtCancel">Annuler</button><button class="btn btn-primary" id="evtSave">Enregistrer</button></div>
        </div>
    `;

    container.appendChild(manager);

    // Bind controls
    document.getElementById('mgrLoadEvents').addEventListener('click', async () => {
        const sd = document.getElementById('mgrStartDate').value;
        const ed = document.getElementById('mgrEndDate').value;
        if (!sd || !ed) { alert('Sélectionnez une plage de dates'); return; }
        await loadCalendarEvents(sd, ed);
    });

    document.getElementById('mgrNewEvent').addEventListener('click', () => {
        openEventForm();
    });

    document.getElementById('evtCancel').addEventListener('click', () => {
        closeEventForm();
    });

    document.getElementById('evtSave').addEventListener('click', async () => {
        const eid = document.getElementById('evtDate').dataset.eventId || null;
        const evt = {
            eventId: eid,
            date: document.getElementById('evtDate').value,
            time: document.getElementById('evtTime').value,
            duration: parseFloat(document.getElementById('evtDuration').value) || 1,
            description: document.getElementById('evtDesc').value || 'RDV',
            type: document.getElementById('evtType').value || 'Autre',
            calendarId: getConfiguredCalendarId()
        };

        try {
            if (eid) {
                const resp = await callBackend('updateCalendarEvent', { event: evt });
                if (!resp || resp.success === false) { showBackendRawResponse(resp); alert('Erreur mise à jour event'); return; }
                showToast('✅ Événement mis à jour');
            } else {
                const resp = await callBackend('addCalendarEvent', { event: evt });
                if (!resp || resp.success === false) { showBackendRawResponse(resp); alert('Erreur création event'); return; }
                showToast('✅ Événement créé');
            }
            closeEventForm();
            // reload list if a range present
            const sd = document.getElementById('mgrStartDate').value;
            const ed = document.getElementById('mgrEndDate').value;
            if (sd && ed) await loadCalendarEvents(sd, ed);
            // Auto-refresh FullCalendar to show new/updated event
            if (window.mti_fullCalendar) window.mti_fullCalendar.refetchEvents();
        } catch (e) { console.error('evtSave failed', e); alert('Erreur lors de la sauvegarde'); }
    });
}

export async function loadCalendarEvents(startDate, endDate) {
    const listEl = document.getElementById('mgrEventsList');
    if (!listEl) return;
    listEl.innerHTML = 'Chargement...';
    try {
        const resp = await callBackend('listCalendarEvents', { startDate: startDate, endDate: endDate, calendarId: getConfiguredCalendarId(), maxResults: 500 });
        if (!resp || resp.success === false) { listEl.innerHTML = 'Erreur chargement'; showBackendRawResponse(resp); return; }
        const events = resp.data && resp.data.events ? resp.data.events : [];
        if (events.length === 0) { listEl.innerHTML = '<div style="padding:8px;">Aucun événement</div>'; return; }
        listEl.innerHTML = '';
        events.forEach(ev => {
            const card = document.createElement('div');
            card.style.borderBottom = '1px solid var(--color-card-border)';
            card.style.padding = '8px';
            const start = new Date(ev.start).toLocaleString('fr-FR');
            const end = new Date(ev.end).toLocaleString('fr-FR');
            card.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><div><strong>${ev.title}</strong><br><span style='font-size:12px;color:var(--color-text-secondary)'>${start} — ${end}</span></div><div style="display:flex; gap:6px;"><button class='btn btn-sm btn-secondary' data-id='${ev.id}' data-action='edit'>✏️</button><button class='btn btn-sm btn-secondary' data-id='${ev.id}' data-action='delete'>🗑️</button></div></div>`;
            listEl.appendChild(card);
            const editBtn = card.querySelector("button[data-action='edit']");
            const delBtn = card.querySelector("button[data-action='delete']");
            editBtn.addEventListener('click', () => openEventForm(ev));
            delBtn.addEventListener('click', async () => {
                if (!confirm('Supprimer cet événement ?')) return;
                try {
                    const dresp = await callBackend('deleteCalendarEvent', { eventId: ev.id, calendarId: getConfiguredCalendarId(), startDate: startDate, endDate: endDate });
                    if (!dresp || dresp.success === false) { showBackendRawResponse(dresp); alert('Erreur suppression'); return; }
                    showToast('✅ Événement supprimé');
                    await loadCalendarEvents(startDate, endDate);
                } catch (e) { console.error('delete event failed', e); alert('Erreur suppression'); }
            });
        });
    } catch (e) { console.error('loadCalendarEvents failed', e); listEl.innerHTML = 'Erreur'; }
}

// Load events from Google Calendar API
export async function loadGoogleCalendarEvents(fetchInfo, successCallback, failureCallback) {
    if (!getIsGoogleSignedIn()) {
        // Return empty array instead of error when not connected
        // This prevents FullCalendar from showing errors on initial load
        console.log('ℹ️ Not connected to Google - returning empty calendar');
        successCallback([]);
        return;
    }

    try {
        const calendarId = getConfiguredCalendarId();
        const response = await gapi.client.calendar.events.list({
            calendarId: calendarId,
            timeMin: fetchInfo.startStr,
            timeMax: fetchInfo.endStr,
            showDeleted: false,
            singleEvents: true,
            orderBy: 'startTime'
        });

        const events = response.result.items.map(event => ({
            id: event.id,
            title: event.summary || '(Sans titre)',
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            description: event.description || '',
            backgroundColor: getEventColor(event),
            borderColor: getEventColor(event),
            extendedProps: {
                googleEvent: event
            }
        }));

        successCallback(events);
    } catch (error) {
        console.error('❌ Error loading calendar events:', error);
        failureCallback(error);
    }
}

// Create event in Google Calendar
export async function createGoogleCalendarEvent(eventData) {
    if (!getIsGoogleSignedIn()) {
        throw new Error('Non connecté à Google');
    }

    const calendarId = getConfiguredCalendarId();

    // Détecte si c'est un événement "toute la journée" (pas d'heure dans la date)
    const isAllDay = !eventData.start.includes('T') || eventData.start.includes('T00:00:00');

    const event = {
        summary: eventData.title,
        description: eventData.description || '',
        start: isAllDay ? {
            date: eventData.start.split('T')[0]
        } : {
            dateTime: eventData.start,
            timeZone: 'Europe/Paris'
        },
        end: isAllDay ? {
            date: eventData.end.split('T')[0]
        } : {
            dateTime: eventData.end,
            timeZone: 'Europe/Paris'
        }
    };

    try {
        const response = await gapi.client.calendar.events.insert({
            calendarId: calendarId,
            resource: event
        });
        console.log('✅ Event created:', response.result);
        return response.result;
    } catch (error) {
        console.error('❌ Error creating event:', error);
        throw error;
    }
}

// Update event in Google Calendar
export async function updateGoogleCalendarEvent(eventId, changes) {
    if (!getIsGoogleSignedIn()) {
        throw new Error('Non connecté à Google');
    }

    const calendarId = getConfiguredCalendarId();
    const updates = {};

    if (changes.title !== undefined) updates.summary = changes.title;

    if (changes.start !== undefined) {
        const isAllDay = !changes.start.includes('T') || changes.start.includes('T00:00:00');
        updates.start = isAllDay ?
            { date: changes.start.split('T')[0] } :
            { dateTime: changes.start, timeZone: 'Europe/Paris' };
    }

    if (changes.end !== undefined) {
        const isAllDay = !changes.end.includes('T') || changes.end.includes('T00:00:00');
        updates.end = isAllDay ?
            { date: changes.end.split('T')[0] } :
            { dateTime: changes.end, timeZone: 'Europe/Paris' };
    }

    if (changes.description !== undefined) updates.description = changes.description;

    try {
        const response = await gapi.client.calendar.events.patch({
            calendarId: calendarId,
            eventId: eventId,
            resource: updates
        });
        console.log('✅ Event updated:', response.result);
        return response.result;
    } catch (error) {
        console.error('❌ Error updating event:', error);
        throw error;
    }
}

// Delete event from Google Calendar
export async function deleteGoogleCalendarEvent(eventId) {
    if (!getIsGoogleSignedIn()) {
        throw new Error('Non connecté à Google');
    }

    const calendarId = getConfiguredCalendarId();

    try {
        await gapi.client.calendar.events.delete({
            calendarId: calendarId,
            eventId: eventId
        });
        console.log('✅ Event deleted:', eventId);
    } catch (error) {
        console.error('❌ Error deleting event:', error);
        throw error;
    }
}

// Initialize FullCalendar with Google Calendar API integration
export async function initFullCalendar() {
    const calendarEl = document.getElementById('fullCalendar');
    if (!calendarEl) {
        console.warn('FullCalendar element not found');
        return;
    }

    // Check if running from file:// protocol - show warning
    const warningEl = document.getElementById('fileProtocolWarning');
    if (window.location.protocol === 'file:') {
        if (warningEl) warningEl.style.display = 'block';
        console.warn('⚠️ Calendar cannot be initialized from file:// protocol');
        return;
    } else {
        if (warningEl) warningEl.style.display = 'none';
    }

    // Initialize Google Auth first
    try {
        await initGoogleAuth();
    } catch (error) {
        console.error('Failed to initialize Google Auth:', error);
        showToast('Erreur d\'authentification Google', 'error');
        return;
    }

    // Initialize FullCalendar
    setFullCalendarInstance(new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'fr',
        firstDay: 1, // Monday
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        height: 'auto',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        buttonText: {
            today: 'Aujourd\'hui',
            month: 'Mois',
            week: 'Semaine',
            day: 'Jour'
        },
        slotLabelFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        // Enable drag & drop (will be disabled until user signs in)
        editable: false,
        selectable: false,
        selectMirror: true,
        dayMaxEvents: true,
        weekends: true,

        // Event sources
        events: loadGoogleCalendarEvents,

        // Handle date selection (create new event)
        select: async function(info) {
            if (!getIsGoogleSignedIn()) {
                showToast('⚠️ Connectez-vous d\'abord à Google', 'warning');
                getFullCalendarInstance().unselect();
                return;
            }

            const title = prompt('Titre de l\'événement:');
            if (title) {
                try {
                    await createGoogleCalendarEvent({
                        title: title,
                        start: info.startStr,
                        end: info.endStr,
                        description: ''
                    });
                    getFullCalendarInstance().refetchEvents();
                    showToast('Événement créé', 'success');
                } catch (error) {
                    showToast('Erreur lors de la création', 'error');
                }
            }
            getFullCalendarInstance().unselect();
        },

        // Handle event drop (move)
        eventDrop: async function(info) {
            if (!getIsGoogleSignedIn()) {
                showToast('⚠️ Connectez-vous d\'abord à Google', 'warning');
                info.revert();
                return;
            }

            try {
                await updateGoogleCalendarEvent(info.event.id, {
                    start: info.event.startStr,
                    end: info.event.endStr
                });
                showToast('Événement déplacé', 'success');
            } catch (error) {
                showToast('Erreur lors du déplacement', 'error');
                info.revert();
            }
        },

        // Handle event resize
        eventResize: async function(info) {
            if (!getIsGoogleSignedIn()) {
                showToast('⚠️ Connectez-vous d\'abord à Google', 'warning');
                info.revert();
                return;
            }

            try {
                await updateGoogleCalendarEvent(info.event.id, {
                    start: info.event.startStr,
                    end: info.event.endStr
                });
                showToast('Durée modifiée', 'success');
            } catch (error) {
                showToast('Erreur lors de la modification', 'error');
                info.revert();
            }
        },

        // Handle event click (edit/delete)
        eventClick: function(info) {
            if (!getIsGoogleSignedIn()) {
                showToast('⚠️ Connectez-vous d\'abord à Google', 'warning');
                return;
            }

            const event = info.event;
            showEventEditModal(event);
        }
    }));

    getFullCalendarInstance().render();
    console.log('✅ FullCalendar initialized with 8h-20h range, Monday-first week, French locale');

    // Show initial state (not connected)
    updateSignInStatus(false);

    // Auto-refresh calendar every 5 minutes to sync with external changes
    // Consommation estimée: ~2000 appels/mois (bien sous la limite Google)
    setInterval(() => {
        if (getIsGoogleSignedIn() && getFullCalendarInstance()) {
            console.log('🔄 Auto-refresh calendar...');
            getFullCalendarInstance().refetchEvents();
        }
    }, 300000); // 5 minutes (300 000 ms)
}

// Legacy function kept for compatibility (redirects to FullCalendar)
export function initGoogleCalendarEmbed() {
    initFullCalendar();
}

// Google Calendar Sync
export async function syncToGoogleCalendar() {
    if (getIsSyncing()) {
        showToast('⏳ Synchronisation déjà en cours...', 'info');
        return;
    }

    try {
        setIsSyncing(true);
        showToast('📅 Synchronisation Calendar...', 'info');

        // Prepare task data for sync - include eventId so we can filter already-synced tasks
        const taskData = getTasks().map(task => ({
            date: task.date,
            startTime: task.startTime,
            duration: task.duration,
            description: task.description,
            type: task.type,
            eventId: task.eventId || null
        }));

        try {
            // Only sync tasks that don't already have an eventId to avoid duplicates
            const tasksToSync = taskData.filter(t => !t.eventId);
            if (tasksToSync.length === 0) {
                showToast('📅 Aucun nouvel événement à synchroniser', 'info');
            } else {
                const result = await callBackend('sync_calendar', { tasks: tasksToSync, calendarId: getConfiguredCalendarId() });
                if (!result || result.success === false) {
                    try { showBackendRawResponse(result); } catch (e) {}
                    throw new Error((result && (result.data || result.error)) || 'Erreur serveur lors de la synchronisation Calendar');
                }

                // Persist returned eventIds into tasks and save
                try {
                    const details = (result.data && result.data.details) || [];
                    details.forEach(d => {
                        if (d && d.eventId && d.task) {
                            // find matching task in client tasks by date/startTime/description
                            const match = getTasks().find(t => t.date === d.task.date && (t.startTime || '') === (d.task.startTime || '') && t.description === d.task.description);
                            if (match) match.eventId = d.eventId;
                        }
                    });
                    await saveToDrive();
                } catch (persistErr) {
                    console.warn('Impossible de persister eventIds:', persistErr);
                }

                // Additionally, fetch events from the calendar for the range and remove local tasks whose eventId no longer exists (handle deletions on the calendar)
                try {
                    // compute date range from tasks
                    const dates = getTasks().map(t => t.date).filter(Boolean).sort();
                    const startDate = dates.length ? dates[0] : formatDate(new Date());
                    const endDate = dates.length ? dates[dates.length - 1] : formatDate(new Date());
                    const eventsResp = await callBackend('listCalendarEvents', { startDate: startDate, endDate: endDate, calendarId: getConfiguredCalendarId() });
                    if (eventsResp && eventsResp.success) {
                        const remoteIds = new Set((eventsResp.data && eventsResp.data.events || []).map(e => e.id));
                        // Remove tasks that have an eventId but that event is not present remotely
                        let removed = 0;
                        for (let i = getTasks().length - 1; i >= 0; i--) {
                            const t = getTasks()[i];
                            if (t && t.eventId && !remoteIds.has(t.eventId)) {
                                getTasks().splice(i, 1);
                                removed++;
                            }
                        }
                        if (removed > 0) {
                            await saveToDrive();
                            renderCalendar();
                            showToast(`✅ ${removed} tâche(s) supprimée(s) (événements absents du calendrier)`,'info');
                        }
                    }
                } catch (cleanupErr) {
                    console.warn('Cleanup calendar deletions failed:', cleanupErr);
                }

                showToast('✅ Planning synchronisé avec Google Calendar', 'success');
            }
        } catch (err) {
            console.error('Calendar sync failed:', err);
            showToast('❌ Erreur de synchronisation Calendar (voir console). Assurez-vous que le BACKEND autorise CORS.', 'error');
        }
    } catch (error) {
        console.error('Calendar sync error:', error);
        showToast('❌ Erreur de synchronisation Calendar', 'error');
    } finally {
        setIsSyncing(false);
    }
}

// PLANNING - Calendar with Day/Week/Month views
// TODO: CALENDAR (Impossible de le bouger pour l'instant)
export function changeCalendarView(view) {
    setCurrentView(view);
    document.getElementById('viewDay')?.classList.remove('active');
    document.getElementById('viewWeek')?.classList.remove('active');
    document.getElementById('viewMonth')?.classList.remove('active');
    const el = document.getElementById('view' + view.charAt(0).toUpperCase() + view.slice(1));
    if (el) el.classList.add('active');
    renderCalendar();
}

// TODO: CALENDAR (Impossible de le bouger pour l'instant)
export function navigateCalendar(direction) {
    if (direction === 0) {
        setCurrentDate(new Date());
    } else if (getCurrentView() === 'day') {
        getCurrentDate().setDate(getCurrentDate().getDate() + direction);
    } else if (getCurrentView() === 'week') {
        getCurrentDate().setDate(getCurrentDate().getDate() + (direction * 7));
    } else if (getCurrentView() === 'month') {
        getCurrentDate().setMonth(getCurrentDate().getMonth() + direction);
    }
    renderCalendar();
}

// TODO: CALENDAR (Impossible de le bouger pour l'instant)
export function renderCalendar() {
    updateCurrentDateDisplay();

    if (getCurrentView() === 'day') {
        renderDayView();
    } else if (getCurrentView() === 'week') {
        renderWeekView();
    } else if (getCurrentView() === 'month') {
        renderMonthView();
    }

    updateWeeklyStats();
}

// TODO: CALENDAR (Impossible de le bouger pour l'instant)
export function updateCurrentDateDisplay() {
    const display = document.getElementById('currentDateDisplay');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };

    if (!display) return;

    if (getCurrentView() === 'day') {
        display.textContent = getCurrentDate().toLocaleDateString('fr-FR', options);
    } else if (getCurrentView() === 'week') {
        const weekDates = getWeekDates(getCurrentDate());
        const start = weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        const end = weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        display.textContent = `Semaine du ${start} au ${end}`;
    } else if (getCurrentView() === 'month') {
        display.textContent = getCurrentDate().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
    }
}

function updateWeeklyStats() {
    let filteredTasks = getTasks();

    if (getCurrentView() === 'week') {
        const weekDates = getWeekDates(getCurrentDate());
        const weekDateStrs = weekDates.map(d => formatDate(d));
        filteredTasks = getTasks().filter(task => weekDateStrs.includes(task.date));
    } else if (getCurrentView() === 'day') {
        const dateStr = formatDate(getCurrentDate());
        filteredTasks = getTasks().filter(task => task.date === dateStr);
    } else if (getCurrentView() === 'month') {
        const year = getCurrentDate().getFullYear();
        const month = getCurrentDate().getMonth();
        filteredTasks = getTasks().filter(task => {
            const taskDate = new Date(task.date);
            return taskDate.getFullYear() === year && taskDate.getMonth() === month;
        });
    }

    const totalHours = filteredTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
    const workHours = filteredTasks.filter(t => t.type === 'Travail').reduce((sum, task) => sum + (task.duration || 0), 0);
    const meetingHours = filteredTasks.filter(t => t.type === 'Réunion client').reduce((sum, task) => sum + (task.duration || 0), 0);
    const adminHours = filteredTasks.filter(t => t.type === 'Administratif').reduce((sum, task) => sum + (task.duration || 0), 0);

    const viewLabel = getCurrentView() === 'day' ? 'journalier' : getCurrentView() === 'week' ? 'hebdomadaire' : 'mensuel';

    const statsEl = document.getElementById('weeklyStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <strong>Total ${viewLabel}: ${totalHours}h</strong> 
            (Travail: ${workHours}h | Réunions: ${meetingHours}h | Admin: ${adminHours}h)
        `;
    }
}