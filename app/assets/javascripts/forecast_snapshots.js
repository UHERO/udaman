
function replayFSrange(fsid) {
    var rangeText = sessionStorage.getItem('udamanFSrange-' + fsid);
    if (rangeText == undefined) return;
    var range = Object.keys(JSON.parse(rangeText));
    document.getElementById('fsRangeStart').value = range['start'];
    document.getElementById('fsRangeEnd').value = range['end'];
}

function storeFSrange(fsid, start, end) {
    sessionStorage.setItem('udamanFSrange-' + fsid, JSON.stringify({ 'start': start, 'end': end }));
}
