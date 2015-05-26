var Particles = (function(win) {

	var MAX_PARTICLES = 10000;
	var MAX_VELOCITY = 2.5;
	var FORCE_GRADIENT = 1.2;
	var PARTICLE_SIZE = 2;


	var SparseArray = function(size) {
		this.data = new Array(size);
		this.freeIndices = new Array(size);
		this.freePointer = size - 1;
		this.used = 0;

		for(var i = 0; i < size; i++) {
			this.freeIndices[i] = i;
		}
	};

	SparseArray.prototype.insert = function(obj) {
		var idx = this.freeIndices[this.freePointer--];
		obj._index = idx;
		this.data[idx] = obj;
		this.used++;
	};

	SparseArray.prototype.remove = function(obj) {
		var idx = obj._index;
		this.freeIndices[++this.freePointer] = idx;
		this.data[idx] = null;
		obj._index = null;
		this.used--;
	};



	var Pool = function(objType, size) {
		this.objType = objType;
		this.objs = new Array(size);
		this.used = new Array(size);
		this.free = new Array(size);
		//Zeig auf das zuletzt hinzugefügt Objekt, oder -1, wenn leer
		this.usedpt = -1;
		//Zeigt auf das nächste leere element
		this.freept = size - 1;

		for(var i = 0; i < size; i++) {
			this.free[i] = i;
		}
	};

	Pool.prototype.create = function(posX, posY, velX, velY, accX, accY, damp) {
		if(this.usedpt == -1) {
			//console.log('erzeuge neues objekt', 'frei: ', freept, 'benutzt', usedpt);
			//return this.createObj(arguments).apply(this);
			return new Particle(posX, posY, velX, velY, accX, accY, damp);
		} else {
			var idx = this.used[this.usedpt--];
			var obj = this.objs[idx];
			this.objs[idx] = null;
			this.free[this.freept--] = idx;

			if(obj.reset) {
				obj.reset(posX, posY, velX, velY, accX, accY, damp);
			}

			return obj;
		}
	};

	Pool.prototype.retain = function(obj) {
		var idx = this.free[this.freept--];
		this.objs[idx] = obj;
		this.used[++this.usedpt] = idx;
	}



	var Vec = {
		create: function(x, y) {
			return [x, y];
		},

		clone: function(a) {
			return [a[0], a[1]];
		},

		add: function(a, b, out) {
			out[0] = a[0] + b[0];
			out[1] = a[1] + b[1];
		},

		mul: function(a, value, out) {
			out[0] = a[0] * value;
			out[1] = a[1] * value;
		},

		magsq: function(a) {
			return (a[0] * a[0]) + (a[1] * a[1]);
		},

		clampsq: function(a, value, out) {
			value *= value;
			var mag = Vec.magsq(a);
			if(mag > value) {
				var mod = value / mag;
				out[0] = a[0] * mod;
				out[1] = a[1] * mod;
			}
		},

		angle: function(a) {
			return Math.atan2(a[0], a[1]);
		},

		fromAngle: function(angle, mag, out) {
			out[0] = Math.cos(angle) * mag;
			out[1] = Math.sin(angle) * mag;
		}
	};


	var Field = function(pos, mass) {
		this.pos = pos || Vec.create(0, 0);
		this.mass = mass || 1.0;
	}

	var Particle = function(posX, posY, velX, velY, accX, accY, damp) {	
		this.pos = [0, 0];
		this.vel = [0, 0];
		this.acc = [0, 0];	
		this.reset(posX, posY, velX, velY, accX, accY, damp);
	};

	Particle.prototype.reset = function(posX, posY, velX, velY, accX, accY, damp) {
		this.pos[0] = posX;
		this.pos[1] = posY;
		this.vel[0] = velX;
		this.vel[1] = velY;
		this.acc[0] = accX;
		this.acc[1] = accY;
		this.damp = damp;
	}

	Particle.prototype.move = function() {
		var vel = this.vel;
		var acc = this.acc;
		var pos = this.pos;
		var damp = this.damp;

		vel[0] += acc[0];
		vel[1] += acc[1];

		Vec.clampsq(vel, MAX_VELOCITY, vel);

		pos[0] += vel[0];
		pos[1] += vel[1];

		vel[0] *= damp;
		vel[1] *= damp;

		acc[0] = acc[1] = 0;
	};

	Particle.prototype.addField = function(fields) {
		var tAccX = 0;
		var tAccY = 0;
		var field, dx, dy, force;

		for(var i = 0; i < fields.length; i++) {
			field = fields[i];

			//console.log('fieldpos', field.pos);

			dx = field.pos[0] - this.pos[0];
			dy = field.pos[1] - this.pos[1];

			force = field.mass / Math.pow(dx*dx + dy*dy, FORCE_GRADIENT) * .6;

			tAccX += dx * force;
			tAccY += dy * force;

		}

		this.acc[0] = tAccX;
		this.acc[1] = tAccY;

		Vec.clampsq(this.acc, 1.0, this.acc);
	}

	var Emitter = function(pos, vel, spread, rate) {
		this.pos = pos || Vec.create(0, 0);
		this.vel = vel || Vec.create(0, 0);
		this.rate = rate || 15;
		this.spread = spread || Math.PI * 2;
		this.enabled = false;
	}

	Emitter.prototype.emit = function(pool) {
		var angle = Vec.angle(this.vel) + this.spread - (Math.random() * this.spread * 2);
		var mag = Vec.magsq(this.vel) * Math.random() * 0.3 + 0.1;
		//TODO 'tmp' vector benutzen

		var vel = Vec.create(0, 0);
		Vec.fromAngle(angle, mag, vel);


		return pool.create(this.pos[0], this.pos[1],
			vel[0], vel[1], 0, 0, 0.9995);

	}

	var App = function() {
		this.cv = document.querySelector('canvas');
		this.cv.width = win.innerWidth;
		this.cv.height = win.innerHeight;
		this.ctx = this.cv.getContext('2d');

		this.particles_pool = new Pool(Particle, MAX_PARTICLES);// createPool(Particle, MAX_PARTICLES);
		//var particles = new List();
		this.plist = new SparseArray(MAX_PARTICLES);

		var emitterVelocity = Vec.create(0, 0);
		Vec.fromAngle(0, 2, emitterVelocity);
		var mouseEmitter = new Emitter(Vec.create(100, 230), emitterVelocity); 

		this.emitters = [mouseEmitter];

		var mouseAttract = new Field(Vec.create(0, 0), 140);
		var mouseRepell  = new Field(Vec.create(0, 0), -140);

		this.fields = [];

		this.mouseMode = 0;
		this.loopHandler = this.mainloop.bind(this);

		/* Create color lookup */
		this.colorLookup = new Array(255);
		for(var i = 0; i < 255; i++) {
			this.colorLookup[i] = this.interpolateRgb(204,12,57,  
				22,147,167,  
				i / 255.0);

		}

		var self = this;
		win.onmousemove = function(ev) {
			switch(self.mouseMode) {
				case 0: {
					mouseEmitter.pos[0] = ev.pageX;
					mouseEmitter.pos[1] = ev.pageY;
					break;
				}

				case 1: {
					if(self.fields.length) {
						self.fields[0].pos[0] = ev.pageX;
						self.fields[0].pos[1] = ev.pageY;
					}
				}
			}
		};

		win.onmousedown = function(ev) {
			console.log("Particles: ", self.plist.used);

			switch(self.mouseMode) {
				case 0: { 
					mouseEmitter.enabled = true; 
					ev.stopPropagation();
					break;
				}

				case 1: {
					if(ev.button == 0) {
						self.fields[0] = mouseAttract;
					} else {
						self.fields[0] = mouseRepell;
					}

					ev.stopPropagation();
					break;
				}

				default: break;
			}

			win.onmousemove(ev);
		};

		win.oncontextmenu = function(ev) {
			ev.stopPropagation();
			return false;
		};

		win.onmouseup = function(ev) {
			mouseEmitter.enabled = false;
			self.fields.length = 0;
		};
	};

	App.prototype.clear = function() {
		this.ctx.save();
		this.ctx.globalCompositeOperation = 'multiply';
		this.ctx.fillStyle = 'rgb(238,238,238)';
		this.ctx.fillRect(0, 0, this.cv.width, this.cv.height);
		this.ctx.restore();
	};

	App.prototype.addParticles = function() {
		if(this.plist.used >= MAX_PARTICLES) {
			return;
		}

		for(var i = 0; i < this.emitters.length; i++) {
			var emitter = this.emitters[i];
			if(emitter.enabled) {
				for(var j = 0; j < emitter.rate; j++) {
					this.plist.insert(emitter.emit(this.particles_pool));
				}
			}
		}
	};

	App.prototype.updateParticles = function() {
		var maxX = this.cv.width;
		var maxY = this.cv.height;

		var plist = this.plist;
		var data = this.plist.data;
		var pool = this.particles_pool;
		var fields = this.fields;
		var fieldslen = this.fields.length;

		var particle, pos;

		for(var i = 0; i < MAX_PARTICLES; i++) {
			particle = data[i];
			if(particle == null) {
				continue;
			}

			pos = particle.pos;
			if( pos[0] < 0 ||
				pos[1] < 0 ||
				pos[0] > maxX ||
				pos[1] > maxY) {

				plist.remove(particle);
				pool.retain(particle);
				continue;
			}

			if(fieldslen) {
				particle.addField(fields);
			}

			particle.move();
		}
	};

	App.prototype.update = function() {
		this.addParticles();
		this.updateParticles();
	};

	App.prototype.interpolateRgb = function(r1, g1, b1, r2, g2, b2, t) {
		var r = (r1 + t * (r2 - r1)) | 0;
		var g = (g1 + t * (g2 - g1)) | 0;
		var b = (b1 + t * (b2 - b1)) | 0;

		return "rgb(" + r + ", " + g + ", " + b + ")";
	};

	App.prototype.setMouseMode = function(str) {
		switch(str) {
			case 'emit': this.mouseMode = 0; break;
			case 'field': this.mouseMode = 1; break;
			default: throw new Error("Unknown mouse mode");
		}
	};

	App.prototype.render = function() {
		//var particle = particles.root;
		var maxVel = MAX_VELOCITY * MAX_VELOCITY;
		var data = this.plist.data;
		var lookup = this.colorLookup;
		var ctx = this.ctx;

		var particle, vel, pos, t;

		for(var i = 0; i < MAX_PARTICLES; i++) {
			particle = data[i];
			if(particle == null) {
				continue;
			}

			pos = particle.pos;
			vel = particle.vel;

			t = ((vel[0] * vel[0]) + (vel[1] * vel[1])) / maxVel;
			t *= 255;
			t |= 0;

			//this.ctx.fillStyle = this.interpolateRgb(204,12,57,  22,147,167,  t);
			ctx.fillStyle = lookup[t];
			ctx.fillRect(pos[0], pos[1],
					 PARTICLE_SIZE, 
					 PARTICLE_SIZE);

		}
	};

	App.prototype.mainloop = function() {
		this.clear();
		this.update();
		this.render();
		win.requestAnimationFrame(this.loopHandler);
	};

	return new App();

})(window);