import { getCurrentDate, getFullCalendarInstance, getTasks } from "./config.js";
import { createGoogleCalendarEvent, getConfiguredCalendarId, renderCalendar } from "./calendar.js";
import { showToast } from "./toast.js";
import { showConfirmation } from "./modal.js";
import { callBackend } from "./api.js";

export function showDayTasks(dateStr) {
    const dayTasks = getTasks().filter(task => task.date === dateStr);
    const date = new Date(dateStr);
    const dateFormatted = date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    if (dayTasks.length === 0) {
        alert(`Aucune tâche pour ${dateFormatted}`);
        return;
    }

    let message = `Tâches pour ${dateFormatted}:\n\n`;
    dayTasks.forEach((task, index) => {
        message += `${index + 1}. ${task.startTime} - ${task.description} (${task.duration}h)\n`;
    });
    message += `\nCliquez sur une tâche dans le calendrier pour la modifier.`;

    alert(message);
}

// Task form
export function setupTaskHandlers() {
    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
            const taskDate = document.getElementById('taskDate');
            if (taskDate) taskDate.value = formatDate(getCurrentDate());
            const card = document.getElementById('taskFormCard');
            if (card) card.style.display = 'block';
        });
    }

    const cancelTask = document.getElementById('cancelTask');
    if (cancelTask) {
        cancelTask.addEventListener('click', () => {
            const card = document.getElementById('taskFormCard');
            if (card) card.style.display = 'none';
            const form = document.getElementById('taskForm');
            if (form) form.reset();
        });
    }

    const taskForm = document.getElementById('taskForm');
    if (taskForm) {
        taskForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const date = document.getElementById('taskDate').value;
            const startTime = document.getElementById('taskTime').value;
            const duration = parseFloat(document.getElementById('taskDuration').value) || 1;
            const type = document.getElementById('taskType').value;
            const description = document.getElementById('taskDescription').value;

            // Calculate start and end datetime
            const startDateTime = new Date(`${date}T${startTime}:00`);
            const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);

            const title = `${type}: ${description}`;

            try {
                // Create event via Google Calendar API
                await createGoogleCalendarEvent({
                    title: title,
                    start: startDateTime.toISOString(),
                    end: endDateTime.toISOString(),
                    description: description
                });

                // Refresh FullCalendar
                if (getFullCalendarInstance()) {
                    getFullCalendarInstance().refetchEvents();
                }

                const card = document.getElementById('taskFormCard');
                if (card) card.style.display = 'none';
                taskForm.reset();
                showToast('Rendez-vous créé avec succès', 'success');
            } catch (error) {
                console.error('Error creating task:', error);
                showToast('Erreur lors de la création du rendez-vous', 'error');
            }
        });
    }
}

// Edit task
export function editTask(index) {
    const task = getTasks()[index];
    if (!task) return;
    document.getElementById('editTaskIndex').value = index;
    document.getElementById('editTaskDate').value = task.date;
    document.getElementById('editTaskTime').value = task.startTime;
    document.getElementById('editTaskDuration').value = task.duration;
    document.getElementById('editTaskType').value = task.type;
    document.getElementById('editTaskDescription').value = task.description;

    const modal = document.getElementById('editTaskModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
    }
}

export function deleteTaskFromEdit() {
    const index = parseInt(document.getElementById('editTaskIndex').value);
    showConfirmation(
        'Supprimer la tâche',
        'Êtes-vous sûr de vouloir supprimer cette tâche ?',
        async () => {
            // If this task has a calendar event, attempt to delete it server-side
            const task = getTasks()[index];
            if (task && task.eventId) {
                try {
                    // Provide a narrow search window to backend to help locate the event if getEventById fails
                    const startDate = (() => { const d = new Date(task.date); d.setDate(d.getDate() - 1); return d.toISOString().slice(0,10); })();
                    const endDate = (() => { const d = new Date(task.date); d.setDate(d.getDate() + 1); return d.toISOString().slice(0,10); })();
                    const resp = await callBackend('deleteCalendarEvent', { eventId: task.eventId, calendarId: getConfiguredCalendarId(), startDate: startDate, endDate: endDate });
                    if (!resp || resp.success === false) {
                        console.warn('deleteCalendarEvent initial failed', resp);
                        // Fallback: try to locate event by listing nearby events (±1 day) and match by title/description
                        try {
                            const startDate = (() => {
                                const d = new Date(task.date);
                                d.setDate(d.getDate() - 1);
                                return d.toISOString().slice(0,10);
                            })();
                            const endDate = (() => {
                                const d = new Date(task.date);
                                d.setDate(d.getDate() + 1);
                                return d.toISOString().slice(0,10);
                            })();
                            const eventsResp = await callBackend('listCalendarEvents', { startDate: startDate, endDate: endDate, calendarId: getConfiguredCalendarId() });
                            if (eventsResp && eventsResp.success && eventsResp.data && eventsResp.data.events) {
                                const cand = eventsResp.data.events.find(ev => {
                                    const titleMatch = task.description && ev.title && ev.title.includes(task.description);
                                    const descMatch = task.description && ev.description && ev.description.includes(task.description);
                                    return titleMatch || descMatch;
                                });
                                if (cand) {
                                    const del2 = await callBackend('deleteCalendarEvent', { eventId: cand.id, calendarId: getConfiguredCalendarId(), startDate: startDate, endDate: endDate });
                                    if (!del2 || del2.success === false) console.warn('Fallback delete also failed', del2);
                                }
                            }
                        } catch (e) { console.warn('Fallback search/delete failed', e); }
                    }
                } catch (e) {
                    console.warn('deleteCalendarEvent failed', e);
                }
            }

            // Remove locally regardless (we attempted server delete)
            getTasks().splice(index, 1);
            renderCalendar();
            document.getElementById('editTaskModal')?.classList.remove('show');
            showToast('Tâche supprimée');
            saveToDrive();
        }
    );
}