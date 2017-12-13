const assert = require('assert');

import Event from '../../../src/events.js';
import StreamController from '../../../src/controller/stream-controller.js';

describe('StreamController tests', function() {

	describe('PDT vs SN tests for discontinuities with PDT', function() {
		var fragPrevious = {
			pdt : 1505502671523,
			endPdt : 1505502676523,
			duration : 5000,
			level : 1,
			start : 10000,
			sn : 2,
			cc : 0
		}
		
		var fragments = [
		{
			pdt : 1505502661523,
			endPdt : 1505502666523,
			level : 2,
			duration : 5000,
			start : 0,
			sn : 0,
			cc : 0
		},
		//Discontinuity with PDT 1505502671523
		{
			pdt : 1505502671523,
			endPdt : 1505502676523,
			level : 2,		
			duration : 5000,
			start : 5000,
			sn : 2,
			cc : 1				
		},
		{
			pdt : 1505502676523,
			endPdt : 1505502681523,
			level : 2,		
			duration : 5000,
			start : 10000,
			sn : 3,
			cc : 1
		},
		{
			pdt : 1505502681523,
			endPdt : 1505502686523,
			level : 2,		
			duration : 5000,
			start : 15000,
			sn : 4,
			cc : 1		
		},
		{
			pdt : 1505502686523,
			endPdt : 1505502691523,
			level : 2,		
			duration : 5000,
			start : 20000,
			sn : 5,
			cc : 1	
		}	
		];
		
		var fragLen = fragments.length;
		var levelDetails ={
			startSN : fragments[0].sn,
			endSN : fragments[fragments.length - 1].sn
		};
		var bufferEnd = fragPrevious.start + fragPrevious.duration;
		var end = fragments[fragments.length - 1].start + fragments[fragments.length - 1].duration;

	  it('Default behaviour for choosing fragment after level loaded which chooses a wrong segment', function () {
		var config = { 
			usePDTSearch : false	//Default behaviour	
		}; 
		var hls = {
			config : config,
			on : function(){}
		};
		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragment(0, fragPrevious, fragLen, fragments, bufferEnd, end, levelDetails);
		
		var resultSN = foundFragment ? foundFragment.sn : -1;
		assert.equal(foundFragment, fragments[3], "Expected sn 4, found sn segment " + resultSN);

	  });
	  
	  it('PDT search choosing fragment after level loaded', function () {
		var config = { 
			usePDTSearch : true	
		};  
		var hls = {
			config : config,
			on : function(){}
		};
		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragment(0, fragPrevious, fragLen, fragments, bufferEnd, end, levelDetails);
		
		var resultSN = foundFragment ? foundFragment.sn : -1;	
		assert.equal(foundFragment, fragments[2], "Expected sn 3, found sn segment " + resultSN);

	  });  
	  
	  it('Unit test _findFragmentBySN', function () {
		var config = { }; 
		var hls = {
			config : config,
			on : function(){}
		};
		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragmentBySN(fragPrevious, fragments, bufferEnd, end);

		var resultSN = foundFragment ? foundFragment.sn : -1;	
		assert.equal(foundFragment, fragments[3], "Expected sn 4, found sn segment " + resultSN);

	  });   

	  it('Unit test _findFragmentByPDT usual behaviour', function () {
		var config = { }; 
		var hls = {
			config : config,
			on : function(){}
		};
		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragmentByPDT(fragments, fragPrevious.endPdt + 1);

		var resultSN = foundFragment ? foundFragment.sn : -1;	
		assert.equal(foundFragment, fragments[2], "Expected sn 3, found sn segment " + resultSN);

	  }); 

	  it('Unit test _findFragmentByPDT beyond limits', function () {
		var config = { }; 
		var hls = {
			config : config,
			on : function(){}
		};
		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragmentByPDT(fragments, fragments[0].pdt - 1);
		var resultSN = foundFragment ? foundFragment.sn : -1;
		assert.equal(foundFragment, null, "Expected sn -1, found sn segment " + resultSN);

		foundFragment = streamController._findFragmentByPDT(fragments, fragments[fragments.length - 1].endPdt + 1);
		resultSN = foundFragment ? foundFragment.sn : -1;
		assert.equal(foundFragment, null, "Expected sn -1, found sn segment " + resultSN);
	  });   
	  
	  it('Unit test _findFragmentByPDT at the beginning', function () {
		var config = { }; 
		var hls = {
			config : config,
			on : function(){}
		};
		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragmentByPDT(fragments, fragments[0].pdt);

		var resultSN = foundFragment ? foundFragment.sn : -1;	
		assert.equal(foundFragment, fragments[0], "Expected sn 1, found sn segment " + resultSN);
	  });   

	  it('Unit test _findFragmentByPDT for last segment', function () {
		var config = { }; 
		var hls = {
			config : config,
			on : function(){}
		};
		var streamController = new StreamController(hls);
		var foundFragment = streamController._findFragmentByPDT(fragments, fragments[fragments.length - 1].pdt );

		var resultSN = foundFragment ? foundFragment.sn : -1;	
		assert.equal(foundFragment, fragments[4], "Expected sn 5, found sn segment " + resultSN);
	  });  
	});

});