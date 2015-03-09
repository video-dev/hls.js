function getDMRandom(apiCall) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', apiCall , false);
    try {
      xhr.send(null);
    } catch(err) {
     return null;
    }

    if(xhr.status === 200) {
      var obj = JSON.parse(xhr.responseText);
      var idx = Math.floor(Math.random()*obj.list.length);
      return obj.list[idx].id;
    } else {
      return null;
    }
}

function getDMURL(url) {
  //return 'http://www.dailymotion.com/cdn/manifest/video/' + url + '.m3u8';
  return 'http://stage-10.dailymotion.com/cdn/manifest/video/' + url + '.m3u8';
}

function loadTestVid() {
  var url = getRandomTestVid();
  if(url) {
    loadStream(video,url);
  } else {
    loadError();
  }
}

function loadDMRandomVid() {
    // // from march 2005 onwards
    // var startTime = new Date(2014,2).getTime();
    // var currentTime = new Date().getTime();
    // var randomStartTime = startTime+Math.floor(Math.random()*(currentTime-startTime));
    // // one month after
    // var randomEndTime = Math.min(randomStartTime + (1000*60*60*24*365/12));

    // console.log("start filter:" + new Date(randomStartTime).toUTCString());
    // console.log("end   filter:" + new Date(randomEndTime).toUTCString());

    // var filter = 'created_after=' + randomStartTime + '&created_before=' + randomEndTime;
    // var apiCall = 'https://api.dailymotion.com/videos?' + filter + '&flags=no_live&limit=50';
    // xhr.open('GET', apiCall , false);
  var url = getDMRandom('https://api.dailymotion.com/videos?longer_than=20&flags=no_live,partner,tvod&limit=100');
  if(url) {
    loadStream(video,url);
  } else {
    loadError();
  }
}

function loadRandomPykeVid() {
  var url = getDMRandom('https://api.dailymotion.com/user/pyke369/videos&limit=100');
  if(url) {
    loadStream(video,url);
  } else {
    loadError();
  }
}

function loadRandomLiveVid() {
  var url = getDMRandom('https://api.dailymotion.com/videos?flags=live_onair&limit=100');
  if(url) {
    url = 'http://www.dailymotion.com/cdn/live/video/' + url + '?protocol=hls';
    loadStream(video,url);
  } else {
    loadError();
  }
}

function loadNextPykeVid() {
  var url = getNextPykeVid();
  if(url) {
    loadStream(video,url);
  } else {
    loadError();
  }
}

var pykeVideoIdx = 0;

function getNextPykeVid() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.dailymotion.com/user/pyke369/videos&limit=100' , false);
    try {
      xhr.send(null);
    } catch(err) {
     return null;
    }

    if(xhr.status === 200) {
      var obj = JSON.parse(xhr.responseText);
      return obj.list[pykeVideoIdx++].id;
    } else {
      return null;
    }
}

function loadError() {
  document.getElementById("HlsStatus").innerHTML = "unable to load random test video, if you ae not on DM domain, consider installing <a href=\"https://chrome.google.com/webstore/detail/allow-control-allow-origi/nlfbmbojpeacfghkpbjhddihlkkiljbi\">Allow-Control-Allow-Origin Chrome Extension</a>";
}

