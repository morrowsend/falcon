(function() {
    var allPageDisplay = null;

    var add = function(type, content) {
        var tab = document.getElementById('blacklist_tbl')
        var row = tab.insertRow()
        var stringCell = row.insertCell()
        stringCell.textContent = content ? content : ''
        stringCell.contentEditable = true
        stringCell.setAttribute('placeholder', 'Add a site \u2026');

        var typeCell = row.insertCell()
        var selectCell = document.createElement('select');
        var option1 = document.createElement('option');
        var option2 = document.createElement('option');
        var option3 = document.createElement('option');
        option1.value = 'PAGE';
        option2.value = 'SITE';
        option3.value = 'REGEX';
        option1.textContent = 'Specific Page';
        option2.textContent = 'Entire Website';
        option3.textContent = 'Regex';
        selectCell.appendChild(option1);
        selectCell.appendChild(option2);
        selectCell.appendChild(option3);
        selectCell.value = type

        typeCell.appendChild(selectCell);

        var enabledCell = row.insertCell()
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        enabledCell.appendChild(checkbox);
        
        var deleteCell = row.insertCell();
        deleteCell.setAttribute('class', 'right aligned');
        var deleteThisCell = document.createElement('a');
        deleteThisCell.setAttribute('class', 'mini ui button red');
        deleteThisCell.textContent = 'Delete'
        deleteThisCell.onclick = function(e) {
            var r = e.target.parentElement.parentElement
            r.parentNode.removeChild(r);
        }
        deleteCell.appendChild(deleteThisCell);
    }

    function cutString(stringToCut) {
        if (stringToCut.length == 0)
            return 'No title'
        if (stringToCut.length <= 75)
            return stringToCut
        return stringToCut.slice(0, 75) + '\u2026'
    }

    function addHistoricPages(pages) {
        var history_table = document.getElementById('history_tbl')
        for(i in pages) {
            var thisRow = document.createElement('tr')
            var historyEntryColumn = document.createElement('td');
            var historyTitle = document.createElement('b');
            historyTitle.textContent = cutString(pages[i].title);
            var historyLineBreak = document.createElement('br');
            var historyLink = document.createElement('a');
            historyLink.href = pages[i].url;
            historyLink.target = '_blank';
            historyLink.textContent = cutString(pages[i].url);
            historyEntryColumn.appendChild(historyTitle);
            historyEntryColumn.appendChild(historyLineBreak);
            historyEntryColumn.appendChild(historyLink);
            
            var dateColumn = document.createElement('td')
            dateColumn.textContent = new Date(pages[i].time).toISOString().replace('T','\u00A0').slice(0,16)
            
            var exportColumn = document.createElement('td')
            var exportButton = document.createElement('a')
            exportButton.setAttribute('class', 'ui button mini blue');
            exportButton.textContent = 'Export';
            exportButton.onclick = function(e) {
                var r = e.target.parentElement.parentElement
                chrome.storage.local.get([r.id.toString()], result => {
                    var a = document.createElement('a');
                    var file = new Blob([JSON.stringify(result[r.id.toString()])], {type: 'application/json'});
                    a.href = URL.createObjectURL(file);
                    a.download = result[r.id.toString()].url.split('/')[2] + '_' + r.id.toString() + '.json';
                    a.click();
                });
            }
            exportColumn.appendChild(exportButton)
            
            var deleteColumn = document.createElement('td')
            var deleteButton = document.createElement('a')
            deleteButton.setAttribute('class', 'ui button mini red');
            deleteButton.textContent = 'Delete'
            deleteButton.onclick = function(e) {
                var r = e.target.parentElement.parentElement
                chrome.storage.local.remove(r.id)
                notie.alert(4, 'Page deleted.', 2)
                r.parentNode.removeChild(r)
            }
            deleteColumn.appendChild(deleteButton)
            
            thisRow.appendChild(historyEntryColumn)
            thisRow.appendChild(dateColumn)
            thisRow.appendChild(exportColumn)
            thisRow.appendChild(deleteColumn)
            
            thisRow.id = pages[i].time;
            history_table.appendChild(thisRow)
        }
    }
    
    function normalize(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }
    
    function getHistory(query = '') {
        var history_table = document.getElementById('history_tbl')
        while (history_table.hasChildNodes()) {
            history_table.removeChild(history_table.lastChild);
        }
        chrome.storage.local.get(function(results) {
            var allPages = []
            var queryParts = query.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(i => i.replace(/"/g, ''));
            for (key in results) {
                if (!isNaN(key) && (results[key].url + '/' + results[key].title + '/' + results[key].text).indexOf(query) != -1) {
                    allPages.push(results[key])
                } else if (!isNaN(key) && queryParts.every(i => normalize(results[key].text).indexOf(normalize(i)) != -1)) {
                    allPages.push(results[key])
                }
            }
            if (allPages.length == 0){
                while (history_table.hasChildNodes()) {
                    history_table.removeChild(history_table.lastChild);
                }
                var emptyRow = document.createElement('tr');
                var emptyColumn = document.createElement('td');
                emptyColumn.setAttribute('class','center aligned');
                emptyColumn.textContent = 'No entry found';            
                emptyRow.appendChild(emptyColumn);
                history_table.appendChild(emptyRow);
            }
            allPages.reverse()
            allPageDisplay = nextPages(allPages)
            addHistoricPages(allPageDisplay.next().value)
        })
    }

    function* nextPages(allPages){
        while(true)
            yield allPages.splice(0, 20)
    }

    chrome.storage.local.get('blacklist', function(result) {
        var bl = result.blacklist
        if (Object.keys(bl).length > 0 && (bl['SITE'].length + bl['PAGE'].length + bl['REGEX'].length > 0)) {
            var tab = document.getElementById('blacklist_tbl')
            var fields = ['SITE', 'PAGE', 'REGEX']
            for (var j = 0; j < fields.length; j++) {
                for (var i = 0; i < bl[fields[j]].length; i++) {
                    add(fields[j], bl[fields[j]][i])
                }
            }
        } else {
            save(false);
        }
    });

    function save(showAlert) {
        var showAlert = (typeof showAlert !== 'undefined') ?  showAlert : true;
        if (showAlert) { notie.alert(4, 'Saved Preferences.', 2); }
        var tab = document.getElementById('blacklist_tbl');
        var indices = [];
        for (var i = 1; i < tab.rows.length; i++) {
            var row = tab.rows[i]
            if (row.cells[0].innerHTML === '') {
                indices.push(i)
            }
        }

        for (var j = indices.length-1; j > -1; j--) {
            tab.deleteRow(indices[j]);
        }

        if (tab.rows.length == 1) {
            chrome.runtime.sendMessage({
                'msg': 'setBlacklist',
                'blacklist': []
            });
            add('SITE', '');
        } else {
            var b = {
                'SITE': [],
                'PAGE': [],
                'REGEX': []
            }
            for(var i = 1; i < tab.rows.length; i++) {
                b[tab.rows[i].cells[1].childNodes[0].value].push(tab.rows[i].cells[0].innerHTML)
            }

            chrome.runtime.sendMessage({
                'msg': 'setBlacklist',
                'blacklist': b
            })
        }
    }

    function loadMore() {
        addHistoricPages(allPageDisplay.next().value);
    }

    function clearAllData() {
        chrome.storage.local.clear();
        notie.alert(1, 'Deleted All Data. Restarting Falcon &hellip;', 2);
        setTimeout(function() {
            chrome.runtime.reload()
        }, 2000);
    }

    function clearRules() {
        chrome.storage.local.get(['blacklist'], function(items) {
            var blacklist = items['blacklist'];
            blacklist['SITE'] = [];
            chrome.storage.local.set({'blacklist':blacklist});
        });
        notie.alert(1, 'Deleted Rules. Restarting Falcon &hellip;', 2);
        setTimeout(function() {
            chrome.runtime.reload()
        }, 2000);
    }

    function clearHistory() {
        chrome.storage.local.get(function(results) {
            var timestaps = results['index']['index'];
            for(key in timestaps){
                chrome.storage.local.remove(timestaps[key]);
            }
            chrome.storage.local.set({'index':{'index':[]}});
        });
        notie.alert(1, 'Deleted History. Restarting Falcon &hellip;', 2);
        setTimeout(function() {
            chrome.runtime.reload()
        }, 2000);
    }
    
    document.addEventListener('DOMContentLoaded', function(event){
        var query = unescape(location.search?.substring(7).replace(/(before|after): ?([^" ]+|"[^"]+") ?/g,''));
        document.getElementById('search_history').value = query;
        getHistory(query);
        
        document.getElementById('save').onclick = save;
        document.getElementById('add').onclick = add;
        document.getElementById('loadmore').onclick = loadMore;

        document.getElementById('clear').onclick = function () {
            notie.confirm('Are you sure you want to do that?', 'Yes', 'Cancel', function() {
                clearAllData();
            });
        }

        document.getElementById('clear-rules').onclick = function () {
            notie.confirm('Are you sure you want to do that?', 'Yes', 'Cancel', function() {
                clearRules();
            });
        }

        document.getElementById('clear-history').onclick = function () {
            notie.confirm('Are you sure you want to do that?', 'Yes', 'Cancel', function() {
                clearHistory();
            });
        }

        document.getElementById('search_history').onkeyup = function () {
            getHistory(document.getElementById('search_history').value);
        }
    });
})();
