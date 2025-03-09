document.addEventListener('DOMContentLoaded', function() {
    const tableBody = document.querySelector('#blacklistTable tbody');
    
    // Access DEFAULT_BLACKLIST which is now available because we imported blacklist.js
    if (typeof DEFAULT_BLACKLIST !== 'undefined') {
        DEFAULT_BLACKLIST.forEach(url => {
            const row = document.createElement('tr');
            
            const urlCell = document.createElement('td');
            urlCell.textContent = url;
            
            const typeCell = document.createElement('td');
            typeCell.textContent = 'Site'; // Default blacklist entries are site-wide
            
            row.appendChild(urlCell);
            row.appendChild(typeCell);
            tableBody.appendChild(row);
        });
    } else {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 2;
        cell.textContent = 'No default blacklist entries found';
        cell.style.textAlign = 'center';
        row.appendChild(cell);
        tableBody.appendChild(row);
    }
});