import { Events } from '../../src/events';

function getAllCapsSnakeCaseToCamelCase(eventType) {
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
      it(
        'should have a value matching generics convention for event type: ' +
          event,
        function () {
          const value = Events[event];
          const expected = 'hls' + getAllCapsSnakeCaseToCamelCase(event);
          expect(value).to.equal(expected);
        }
      );
    });
  });
});
