var vid = document.getElementById('videoel');
var overlay = document.getElementById('overlay');
var overlayCC = overlay.getContext('2d');

var deltaThreshold = 0.25; //Threshold for when we consider a change significant
var queryValues = [0,0,0,0];
var currentValues = [0,0,0,0];
var lastQueryTime = 0.0;
var lastGifChangeTime = 0.0;
var timeThreshold = 1000 //in milliseconds. time we want them to 'hold' a smile


/********** check and set up video/webcam **********/
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
window.URL = window.URL || window.webkitURL || window.msURL || window.mozURL;

// check for camerasupport
if (navigator.getUserMedia) {
	// set up stream
	var videoSelector = {video : true};
	if (window.navigator.appVersion.match(/Chrome\/(.*?) /)) {
		var chromeVersion = parseInt(window.navigator.appVersion.match(/Chrome\/(\d+)\./)[1], 10);
		if (chromeVersion < 20) {
			videoSelector = "video";
		}
	};

	navigator.getUserMedia(videoSelector, function( stream ) {
		if (vid.mozCaptureStream) {
			vid.mozSrcObject = stream;
		} else {
			vid.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
		}
		vid.play();
	}, function() {
		alert("There was some problem trying to fetch video from your webcam. If you have a webcam, please make sure to accept when the browser asks for access to your webcam.");
	});
} else {
	alert("This demo depends on getUserMedia, which your browser does not seem to support. :(");
}

/* Fading features */
function fadeInNewGif(url) {
	gifSelector = $("img#gif")
	gifSelector.fadeOut(300);
	gifSelector.attr("src", url);
	gifSelector.fadeIn(300);
}

/*********** setup of emotion detection *************/
var ctrack = new clm.tracker({useWebGL : true});
ctrack.init(pModel);

function startVideo() {
	vid.play();
	ctrack.start(vid);
	drawLoop();
	setInterval(drawGifLoop, 50);
}

function deltaChanged(data){
	for (var i = 0; i < currentValues.length; i++) {
		if (Math.abs(currentValues[i]-queryValues[i]) > deltaThreshold){
			return true;
		}
	}
	return false;
}

function grabGif(myData){
	// emotionMapping maps the facial-terms to the mIDs associated with the GIFGIF metrics
	var emotionMapping = {"happy": "54a309ae1c61be23aba0da5c", "angry": "54a309ae1c61be23aba0da54", "sad": "54a309ae1c61be23aba0da60", "surprised": "54a309ae1c61be23aba0da63"};
	var emotionArray = [];
	var valueArray = [];

	var noData = true;

	for (var i = 0; i < myData.length; i++) {
		var datum = myData[i];
		emotion = emotionMapping[datum.emotion];
		value = Math.round(datum.value * 100) / 100;
		if (value > deltaThreshold){ // If it's not pretty much zero...
			noData = false; // This will be used to eventually remove any gif.
		}
		valueArray.push(value/2+0.5);
		emotionArray.push(emotion);
	}

	if (noData){
		$("#gif").attr("src", "");
	}else{
	    var jitter = String(Math.floor(Math.random()*13));

	    var url = 'https://www.qnt.io/api/search?pID=gifgif&mID=['+emotionArray+']&metric_score=['+valueArray+']&limit=1&skip='+jitter+'&key=54a309ac1c61be23aba0da3f';
		$.ajax({
			type: "GET",
			url: url
		}).done(function(data) {
			embedUrl = data["results"][0]['content_data']["embedLink"];
			currentTime = new Date().getTime();
			// console.log(currentTime - lastGifChangeTime, embedUrl);
			if (currentTime - lastGifChangeTime > timeThreshold){
				fadeInNewGif(embedUrl);
				lastGifChangeTime = currentTime;
			}
		})
	}
}

function drawGif(data) {
	var myData = data;
	for (var i = 0; i < myData.length; i++) {
		var datum = myData[i];
		value = Math.round(datum.value * 100) / 100;	
		currentValues[i] = value
	}
	
	if (deltaChanged(currentValues)){
		currentTime = new Date().getTime();
		if (currentTime-lastQueryTime > timeThreshold){
			queryValues = currentValues.slice(0);
			grabGif(myData);
			lastQueryTime = currentTime;
		}
	}
}


function drawLoop() {
	requestAnimFrame(drawLoop);
	overlayCC.clearRect(0, 0, 400, 300);
	if (ctrack.getCurrentPosition()) {
		ctrack.draw(overlay);
	}
	var cp = ctrack.getCurrentParameters();
	var er = ec.meanPredict(cp);

	if (er) {
		updateData(er);
	}
}

function drawGifLoop() {
	$("div.label").css({display: "none"});
	var cp = ctrack.getCurrentParameters();
	var er = ec.meanPredict(cp);

	if (er) {
		drawGif(er);
	}
}

var ec = new emotionClassifier();
ec.init(emotionModel);
var emotionData = ec.getBlank();	

/************ d3 code for barchart *****************/
var margin = {top : 10, right : 0, bottom : 35, left : 10},
width = 200 - margin.left - margin.right,
height = 100 - margin.top - margin.bottom;

var barWidth = 30;

var formatPercent = d3.format(".0%");

var x = d3.scale.linear()
.domain([0, ec.getEmotions().length]).range([margin.left, width+margin.left]);

var y = d3.scale.linear()
.domain([0,1]).range([0, height]);

var emotionMapping = {
	angry: "Anger",
	sad: "Sadness",
	surprised: "Surprise",
	happy: "Happiness"
}

var svg = d3.select("#emotion_chart").append("svg")
.attr("width", width + margin.left + margin.right)
.attr("height", height + margin.top + margin.bottom)

svg.selectAll("rect")
    .data(emotionData)
    .enter()
    .append("svg:rect")
    .attr("x", function(datum, index) { return x(index); })
    .attr("y", function(datum) { return height - y(datum.value); })
    .attr("height", function(datum) { return y(datum.value); })
    .attr("width", barWidth)
    .attr("fill", "#800080");

svg.selectAll("text.labels")
    .data(emotionData)
    .enter()
    .append("svg:text")
    .attr("x", function(datum, index) { return x(index) + barWidth; })
    .attr("y", function(datum) { return height - y(datum.value); })
    .attr("dx", -barWidth/2)
    .attr("dy", "1.2em")
    .attr("text-anchor", "middle")
    .text(function(datum) { return datum.value;})
    .attr("fill", "white")
    .attr("class", "labels")
svg.selectAll("text.yAxis")
    .data(emotionData)
    .enter().append("svg:text")
    .attr("x", function(datum, index) { return x(index) + barWidth; })
    .attr("y", height + 22)
    .attr("dx", -barWidth/2)
    .attr("text-anchor", "middle")
    .attr("style", "font-size: 10")
    .text(function(datum) { return emotionMapping[datum.emotion];})
    .attr("fill", "white")
    .attr("transform", "translate(0, 18)")
    .attr("class", "yAxis")

function updateData(data) {
	// update
	var rects = svg.selectAll("rect")
	.data(data)
	.attr("y", function(datum) { return height - y(datum.value); })
	.attr("height", function(datum) { return y(datum.value); });
	var texts = svg.selectAll("text.labels")
	.data(data)
	.attr("y", function(datum) { return height - y(datum.value); })
	.text(function(datum) { return datum.value.toFixed(1);});

	// enter 
	rects.enter().append("svg:rect");
	texts.enter().append("svg:text");

	// exit
	rects.exit().remove();
	texts.exit().remove();
}

/******** stats ********/
stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.top = '0px';
startVideo();
