class LevelSuppression {
  constructor() {
    this._levelsSuppressed = {};
  }

  isSuppressed(level) {

    let expiration = this._levelsSuppressed[level];

    if (Date.now() < expiration) {
      return true;
    }

    if (this._levelsSuppressed[level]) {
      delete this._levelsSuppressed[level];
    }

    return false;
  }

  isAllSuppressed(min, max) {
    for (var i = min; i <= max; i++) {
      if (!this.isSuppressed(i)) {
        return false;
      }
    }
    return true;
  }

  set(level, ttl) {
    this._levelsSuppressed[level] = ttl + Date.now();
  }

}

export default LevelSuppression;
