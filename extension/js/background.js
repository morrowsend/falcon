let preloaded = [];
let cache = {};
let blacklist = {};
let preferences = {};
let timeIndex = [];

var DEFAULT_DATE_OFFSET = 14;
var CUTOFF_DATE = new Date();
CUTOFF_DATE.setDate(CUTOFF_DATE.getDate() - DEFAULT_DATE_OFFSET);


var MILLIS_BEFORE_CLEAR = 1000 * 60; // 60 seconds
var CLEAR_DELAY = 20000;
var LT = function(a,b) {return a < b};
var GT = function(a,b) {return a > b};
var LT_OBJ = function(a,b) {
    return a.time < b.time;
}

var GT_OBJ = function(a,b) {
    return a.time > b.time;
}

Array.max = function( array ){
    return Math.max.apply(Math,array);
};

function ValidURL(text) {
    var valid = /((https?):\/\/)?(([w|W]{3}\.)+)?[a-zA-Z0-9\-\.]{3,}\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?/
    return valid.test(text);
}

chrome.omnibox.onInputChanged.addListener(omnibarHandler);
chrome.omnibox.onInputEntered.addListener(acceptInput);
chrome.runtime.onMessage.addListener(handleMessage);
chrome.runtime.onInstalled.addListener(function (object) {
    chrome.storage.local.get("shouldOpenTab", function(item) {
        if (Object.keys(item).length == 0) {
            chrome.tabs.create({url: "https://github.com/morrowsend/falcon"}, function (tab) {
            });
            chrome.storage.local.set({"shouldOpenTab": {"dontShow": true}})
        }
    })
});

function acceptInput(text, disposition) {
    // disposition: "currentTab", "newForegroundTab", or "newBackgroundTab"
    if (!ValidURL(text)) {
        text = "assets/preferences.html?query=" + text;
    }
    switch (disposition) {
    case "currentTab":
        chrome.tabs.update({url: text});
        break;
    case "newForegroundTab":
        chrome.tabs.create({url: text});
        break;
    case "newBackgroundTab":
        chrome.tabs.create({url: text, active: false});
        break;
    }
}

function init() {
    preloaded = [];
    cache = {};
    chrome.storage.local.get(['blacklist', 'preferences'], function(items) {
        var obj = items['blacklist'];
        if (obj === undefined || !('PAGE' in obj && 'SITE' in obj && 'REGEX' in obj)) {
            blacklist = {'PAGE':[], 'REGEX':[], 'SITE':[]}; // show example in page
            chrome.storage.local.set({'blacklist':blacklist});
        } else {
            blacklist = obj;
        }

        var obj = items['preferences'];
        if (obj === undefined) {
            preferences = {};
            chrome.storage.local.set({'preferences':preferences});
        } else {
            preferences = obj;
        }
    });

    chrome.storage.local.get('index', function(items) {
        var obj = items['index'];
        if (obj === undefined || !obj.index) {
            timeIndex = [];
            chrome.storage.local.get(null, function(items) {
                if (items) {
                    for (var key in items) {
                        if (key != 'index' && items[key] && items[key].time) {
                            timeIndex.push(items[key].time.toString());
                        }
                    }
                    timeIndex.sort(function(a,b) {return parseInt(a) - parseInt(b)}); // soonest last
                    makePreloaded(timeIndex);
                    chrome.storage.local.set({'index':{'index':timeIndex}});
                }
            });
        } else {
            timeIndex = Array.isArray(obj.index) ? obj.index : [];
            makePreloaded(timeIndex);
        }
    });
}

function makePreloaded(index) {
    var preloaded_index = [];
    var millis = +CUTOFF_DATE;
    var i = Math.floor(binarySearch(index, millis, LT, GT, 0, index.length));
    for (var j = i; j < index.length; j++) {
        preloaded_index.push(index[j]);
    }

    chrome.storage.local.get(preloaded_index, function(items) {
        preloaded = [];
        for (var key in items) {
            preloaded.push(items[key]);
        }

        preloaded.sort(function(a,b){return a.time-b.time});
    });
}

function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

function handleMessage(data, sender, sendResponse) {
    // data is from message
    if (data.msg === 'pageContent' && shouldArchive(data)) {
        delete data.msg;
        data.text = processPageText(data.text);
        var time = data.time;
        var keyValue = {};
        keyValue[time] = data;
        chrome.storage.local.get(function(results) {
            for (key in results) {
                if (!isNaN(key) && (results[key].url == data.url) && results[key].text == data.text) {
                    return;
                }
            }
            chrome.storage.local.set(keyValue, function() { 
                console.log("Stored: " + data.title);
            });
            timeIndex.push(time.toString());
            preloaded.push(data);
            chrome.storage.local.set({'index':{'index':timeIndex}});
        });

    } else if (data.msg === 'setPreferences') {
        preferences = data.preferences;
        chrome.storage.local.set({'preferences':preferences});
    } else if (data.msg === 'setBlacklist') {
        blacklist = data.blacklist;
        chrome.storage.local.set({'blacklist':blacklist});
    }
}

function omnibarHandler(text, suggest) {
    dispatchSuggestions(text, suggestionsComplete, suggest);
}

function suggestionsComplete(suggestions, shouldDate, suggestCb) {
    var res = [];
    var i;
    for (i = 0; i < suggestions.length; i++) {
        var elem = suggestions[i];
        var date = new Date(elem.time).toISOString();
        var description = date.slice(0,10) + (shouldDate ? ', ' + date.slice(11,16) : '') + ': ' + escape(elem.title);
        res.push({content:elem.url, description:description});
    }
    if (res.length > 0) {
        chrome.omnibox.setDefaultSuggestion({description: "Tip: Use time filters, example: before:\"2 weeks ago\""});
    } else {
        chrome.omnibox.setDefaultSuggestion({description: "No results found"})
    }
    suggestCb(res);
    setTimeout(clearCache, CLEAR_DELAY);
}

function clearCache() {
    return;
    var now = +(new Date());

    for (var time in cache) {
        if (now - parseInt(time) > MILLIS_BEFORE_CLEAR) {
            delete cache[time];
        }
    }
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function shouldArchive(data) {
    var site = blacklist["SITE"];
    var page = blacklist["PAGE"];
    var regex = blacklist["REGEX"];
    var url = data.url;

    site = site.concat(self.DEFAULT_BLACKLIST);
    for (var i = 0; i < site.length; i++) {
        if (site[i].split('/').length > 2 && url.indexOf(site[i].split('/')[2]) != -1) {
            return false;
        }
    }

    for (var i = 0; i < page.length; i++) {
        if (cleanURL(data.url) == page[i]) {
            return false;
        }
    }

    for (var i = 0; i < regex.length; i++) {
        if (url.match(regex[i]) != null) {
            return false;
        }
    }

    return true;
}

function makeSuggestions(query, candidates, cb, suggestCb) {
    var res = [];
    var urls = {};
    var keywords = query.keywords;
    var keywordsLen = keywords.length;
    var negative = query.negative;
    var negativeLen = negative.length;
    var j = 0;
    for (var i = candidates.length - 1; i > -1; i--) {
        var text = candidates[i].text;
        var isMatching = true;
        for (var k = 0; k < negativeLen; k++) {
            if (text.indexOf(negative[k]) > -1) {
                isMatching = false;
            }
        }

        if (isMatching) {
            for (var k = 0; k < keywordsLen; k++) {
                if (text.indexOf(keywords[k]) === -1) {
                    isMatching = false;
                    break;
                }
            }

            if (isMatching) {
                var cleanedURL = cleanURL(candidates[i].url);
                if (!(cleanedURL in urls)) {
                    res.push(candidates[i]);
                    urls[cleanedURL] = true;
                    j += 1;
                    if (j === 6) {
                        break;
                    }
                }
            }
        }
    }

    cb(res,query.shouldDate,suggestCb);
}

function cleanURL(url) {
    return url.trim().replace(/(#.+?)$/, '');
}

function dispatchSuggestions(text, cb, suggestCb) {
    var query = makeQueryFromText(text);
    if (query.before !== false && query.after !== false && query.after >= query.before) return;

    query.keywords.sort(function(a,b){return b.length-a.length});

    if (query.after >= CUTOFF_DATE) {
        var start = Math.floor(binarySearch(preloaded, {'time':+query.after}, LT_OBJ,
                                            GT_OBJ, 0, preloaded.length));
        var end;
        if (query.before) {
            end = Math.ceil(binarySearch(preloaded, {'time':+query.before}, LT_OBJ,
                                         GT_OBJ, 0, preloaded.length));
        } else {
            end = preloaded.length;
        }

        makeSuggestions(query, preloaded.slice(start, end), cb, suggestCb)
    } else {
        var start = Math.floor(binarySearch(timeIndex, +query.after, LT,
                                            GT, 0, timeIndex.length));
        var end;
        if (query.before) {
            end = Math.ceil(binarySearch(timeIndex, +query.before, LT,
                                         GT, 0, timeIndex.length));
        } else {
            end = timeIndex.length;
        }

        let sorted = [];
        var get = timeIndex.slice(start, end);
        var index = Math.ceil(binarySearch(get, +CUTOFF_DATE, LT, GT, 0, get.length));
        if (index < get.length) {
            sorted = preloaded.slice(0, get.length - index + 1);
        }
        get = get.slice(0,index);

        chrome.storage.local.get(get, function(items) {
            for (var key in items) {
                sorted.push(items[key]);
            }
            sorted.sort(function(a,b) {return a.time - b.time});
            makeSuggestions(query, sorted, cb, suggestCb);
        });
    }
}

function binarySearch(arr, value, lt, gt, i, j) {
    if (Math.abs(j - i) <= 1) {
        return (i + j)/2;
    }

    var m = Math.floor((i + j)/2)
    var cmpVal = arr[m];
    if (gt(cmpVal, value)) {
        j = m;
    } else if (lt(cmpVal, value)){
        i = m;
    } else {
        return m;
    }
    return binarySearch(arr, value, lt, gt, i, j);
}

init();