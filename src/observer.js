import EventEmitter from 'events';

let observer = new EventEmitter();

observer.trigger = function trigger(event, ...data) {
    observer.emit(event, event, ...data);
};

observer.off = function off(event, ...data) {
    observer.removeListener(event, ...data);
};

export default observer;
