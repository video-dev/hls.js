import Events from '../../src/events';
let assert = require('assert');

function getAllCapsSnakeCaseToCamelCase (eventType) {
  let eventValue = '';
  let previousWasUscore, nextChar;

  for (let i = 0; i < eventType.length; i++) {
    nextChar = eventType.charAt(i);
    if (i !== 0 && !previousWasUscore) {
      nextChar = nextChar.toLowerCase();
    }

    previousWasUscore = false;
    if (nextChar === '_') {
      previousWasUscore = true;
      continue;
    }
    eventValue += nextChar;
  }
  return eventValue;
}

describe('Events tests', function () {
  describe('Events enumeration', function () {
    Object.keys(Events).forEach(function (event) {
      it('should have a value matching generics convention for event type: ' + event, function () {
        let value = Events[event];
        let expected = 'hls' + getAllCapsSnakeCaseToCamelCase(event);
        assert.equal(value, expected);
      });
    });
  });
});
