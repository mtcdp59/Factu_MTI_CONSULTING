// Get event color based on type/category
export function getEventColor(googleEvent) {
    const summary = (googleEvent.summary || '').toLowerCase();
    if (summary.includes('travail') || summary.includes('dev')) return '#218c8d'; // Teal
    if (summary.includes('réunion') || summary.includes('meeting')) return '#3B82F6'; // Blue
    if (summary.includes('admin') || summary.includes('administratif')) return '#626c71'; // Gray
    return '#218c8d'; // Default teal
}

export function openEventForm(ev) {
    const form = document.getElementById('mgrEventForm');
    if (!form) return;
    if (!ev) {
        document.getElementById('evtDate').value = '';
        document.getElementById('evtTime').value = '';
        document.getElementById('evtDuration').value = 1;
        document.getElementById('evtDesc').value = '';
        document.getElementById('evtType').value = 'Travail';
        document.getElementById('evtDate').dataset.eventId = '';
    } else {
        const start = new Date(ev.start);
        document.getElementById('evtDate').value = start.toISOString().slice(0,10);
        document.getElementById('evtTime').value = start.toTimeString().slice(0,5);
        const end = new Date(ev.end);
        const duration = (end - start) / (1000*60*60);
        document.getElementById('evtDuration').value = duration;
        document.getElementById('evtDesc').value = ev.title || '';
        // No strong mapping for type; attempt to parse description
        document.getElementById('evtType').value = (ev.description && ev.description.indexOf('Réunion') !== -1) ? 'Réunion' : 'Travail';
        document.getElementById('evtDate').dataset.eventId = ev.id;
    }
    form.style.display = 'block';
}

export function closeEventForm() {
    const form = document.getElementById('mgrEventForm');
    if (!form) return; form.style.display = 'none';
}