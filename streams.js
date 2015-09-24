var teststreams = [{
  file:'http://www.streambox.fr/playlists/x36xhzz/x36xhzz.m3u8',
  title: 'Big Buck Bunny 1080p HFR'
},{
  file:'http://www.streambox.fr/playlists/x31jrg1/x31jrg1.m3u8',
  title: 'Costa Rica 1080p'
},{
  file:'http://www.streambox.fr/playlists/x212fsj/x212fsj.m3u8',
  title: 'Tears of Steel 1080p'
},{
  file:'http://www.streambox.fr/playlists/x31e0e7/x31e0e7.m3u8',
  title: 'Pipe Dream 1080p'
}
];


function createButtons() {
  for(var i=0; i<teststreams.length; i++) {
    createButton(teststreams[i].title,teststreams[i].file);
  }
}

function _loadStream() {
  loadStream(this.url);
}

function createButton(title,url) {
    var button = document.createElement("input");
    button.type = "button";
    button.value = title;
    button.class = "btn btn-sm";
    button.onclick = _loadStream;
    button.url = url;
    document.getElementById('customButtons').appendChild(button);
}

createButtons();
