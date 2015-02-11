import EventEmitter from 'events';

let observer = new EventEmitter();

observer.trigger = function trigger(event, ...data) {
    observer.emit(event, event, ...data);
};

export default observer;
