class Queue {
  constructor() {
    this.queues = new Map();
  }

  get(guildId) {
    if (!this.queues.has(guildId)) this.create(guildId);
    return this.queues.get(guildId);
  }

  create(guildId) {
    const queue = {
      songs: [],
      nowPlaying: null,
      volume: 100,
      filters: {},
      textChannel: null,
      loop: 'off', // off, track, queue
    };
    this.queues.set(guildId, queue);
    return queue;
  }

  delete(guildId) {
    this.queues.delete(guildId);
  }

  addSong(guildId, song) {
    const queue = this.get(guildId);
    queue.songs.push(song);
  }

  getNext(guildId) {
    const queue = this.get(guildId);
    if (!queue) return null;

    if (queue.loop === 'track' && queue.nowPlaying) {
      return queue.nowPlaying; // repeat same song
    }

    if (queue.loop === 'queue' && queue.songs.length === 0 && queue.nowPlaying) {
      queue.songs.push(queue.nowPlaying); // re-add current to end of queue
    }

    return queue.songs.shift() || null;
  }

  clear(guildId) {
    const queue = this.get(guildId);
    if (queue) queue.songs = [];
  }

  // THIS IS THE MISSING PIECE
  setNowPlaying(guildId, track) {
    const queue = this.get(track.guildId || track.guild?.id);
    if (queue) queue.nowPlaying = track;
  }
}

export default new Queue();
