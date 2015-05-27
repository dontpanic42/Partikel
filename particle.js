var Particles = (function(win) {

	var MAX_PARTICLES = 10000;
	var MAX_VELOCITY = 2.5;
	var FORCE_GRADIENT = 1.2;
	var PARTICLE_SIZE = 2;
	var MAX_NUM_COLORS = 16;


	var LinkedList = function() {
		this.root = null;
		this.length = 0;
	};

	LinkedList.prototype.insert = function(obj) {
		this.length++;

		if(this.root == null) {
			this.root = obj;
		} else {
			this.root.prev = obj;
			obj.next = this.root;
			this.root = obj;
		}
	};

	LinkedList.prototype.remove = function(obj) {
		this.length--;

		if(obj.next) {
			obj.next.prev = obj.prev;
		}

		if(obj.prev) {
			obj.prev.next = obj.next;
		} else {
			this.root = obj.next;
		}
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

	Pool.prototype.create = function(posX, posY, velX, velY, damp) {
		if(this.usedpt == -1) {
			//console.log('erzeuge neues objekt', 'frei: ', freept, 'benutzt', usedpt);
			//return this.createObj(arguments).apply(this);
			return new Particle(posX, posY, velX, velY, damp);
		} else {
			var idx = this.used[this.usedpt--];
			var obj = this.objs[idx];
			this.objs[idx] = null;
			this.free[this.freept--] = idx;

			if(obj.reset) {
				obj.reset(posX, posY, velX, velY, damp);
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
		/*
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
		*/
		magsq: function(a) {
			return (a[0] * a[0]) + (a[1] * a[1]);
		},

		clampsq: function(a, value) {
			value *= value;
			var mag = (a[0] * a[0]) + (a[1] * a[1]);
			if(mag > value) {
				var mod = value / mag;
				a[0] *= mod;
				a[1] *= mod;
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
		this.pos = pos || new Array(2);
		this.mass = mass || 1.0;
	}

	var Particle = function(posX, posY, velX, velY, accX, accY, damp) {	
		this.data = new Array(4);	//0, 1 = pos, 2,3 = vel, 4,5 acc
		//this.vel = new Array(2);
		//this.acc = new Array(2);
		this.next = null;
		this.prev = null;	
		this.reset(posX, posY, velX, velY, accX, accY, damp);
	};

	Particle.prototype.reset = function(posX, posY, velX, velY, damp) {
		this.data[0] = posX;
		this.data[1] = posY;
		this.data[2] = velX;
		this.data[3] = velY;
		this.next = null;
		this.prev = null;
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

		var vel = [0, 0];
		Vec.fromAngle(angle, mag, vel);


		return pool.create(this.pos[0], this.pos[1],
			vel[0], vel[1], 0.9995);

	}

	var App = function() {
		this.cv = document.querySelector('canvas');
		this.cv.width = win.innerWidth;
		this.cv.height = win.innerHeight;
		this.ctx = this.cv.getContext('2d');

		this.particles_pool = new Pool(Particle, MAX_PARTICLES);// createPool(Particle, MAX_PARTICLES);

		//var particles = new List();
		this.plist = new LinkedList();

		var emitterVelocity = [0, 0];
		Vec.fromAngle(0, 2, emitterVelocity);
		var mouseEmitter = new Emitter([100, 230], emitterVelocity); 

		this.emitters = [mouseEmitter];

		var mouseAttract = new Field([0, 0], 140);
		var mouseRepell  = new Field([0, 0], -140);

		this.fields = [];

		this.mouseMode = 0;
		this.loopHandler = this.mainloop.bind(this);

		/* Create color lookup */
		this.colorLookup = new Array(MAX_NUM_COLORS);
		for(var i = 0; i < MAX_NUM_COLORS; i++) {
			this.colorLookup[i] = this.interpolateRgb(
				204,  12,  57,  
				 22, 147, 167,  
				i / MAX_NUM_COLORS);

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
			console.log("Particles: ", self.plist.length);

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
		var plist = this.plist;
		if(plist.length >= MAX_PARTICLES) {
			return;
		}

		for(var i = 0; i < this.emitters.length; i++) {
			var emitter = this.emitters[i];
			if(emitter.enabled) {
				for(var j = 0; j < emitter.rate && this.plist.length < MAX_PARTICLES; j++) {
					plist.insert(emitter.emit(this.particles_pool));
				}
			}
		}
	};

	App.prototype.updateParticles = function() {
		var maxX = this.cv.width;
		var maxY = this.cv.height;

		var plist = this.plist;
		//var data = this.plist.data;
		var pool = this.particles_pool;
		var fields = this.fields;
		var fieldslen = this.fields.length;

		var particle, pos, vel, damp, data, acc = [0, 0];
		var field, dx, dy, force, fpos, tpos, i, j;

		var maxp = MAX_PARTICLES;
		var particle = plist.root;
		var magsq, fak, maxvel = MAX_VELOCITY * MAX_VELOCITY;

		var posx, posy, velx, vely, damp = 0.9995;

		while(particle != null) {

			data = particle.data;
			posx = data[0];
			posy = data[1];

			if( posx < 0 ||
				posy < 0 ||
				posx > maxX ||
				posy > maxY) {

				plist.remove(particle);
				pool.retain(particle);

				particle = particle.next;
				continue;
			}

			velx = data[2];
			vely = data[3];

			/** Particle-Field interaction **/
			for(j = 0; j < fieldslen; j++) {
				field = fields[j];
				fpos = field.pos;

				dx = fpos[0] - posx;
				dy = fpos[1] - posy;

				force = field.mass / Math.pow(dx*dx + dy*dy, FORCE_GRADIENT) * .6;

				//war: Acceleration vector
				velx += dx * force;
				vely += dy * force;
			}
			/** Particle-Field interaction end

			/** Particle movement (inlined) **/

			//Vec.clampsq(vel, MAX_VELOCITY);
			magsq = velx * velx + vely * vely;
			if(magsq > maxvel) {
				fak = maxvel / magsq;
				velx *= fak;
				vely *= fak;
			}

			data[0] += velx;
			data[1] += vely;

			data[2] = damp * velx;
			data[3] = damp * vely;
			/** Particle movement end **/

			particle = particle.next;
		}
	};

	App.prototype.update = function() {
		this.addParticles();
		this.updateParticles();
	};

	App.prototype.intTo8BitHex = function(d) {
		if(d > 255 || d < 0) {
			throw new Error("invalid range for d (" + d + ")");
		}

  		var hex = Number(d).toString(16);
  		hex = "00".substr(0, 2 - hex.length) + hex; 
  		return hex;
	};

	App.prototype.rgbToHex = function(r, g, b) {
		return "#" + this.intTo8BitHex(r) + 
					 this.intTo8BitHex(g) + 
					 this.intTo8BitHex(b);
	};

	App.prototype.interpolateRgb = function(r1, g1, b1, r2, g2, b2, t) {
		var r = (r1 + t * (r2 - r1)) | 0;
		var g = (g1 + t * (g2 - g1)) | 0;
		var b = (b1 + t * (b2 - b1)) | 0;

		//return "rgb(" + r + ", " + g + ", " + b + ")";
		return this.rgbToHex(r, g, b);
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
		var plist = this.plist;
		var lookup = this.colorLookup;
		var ctx = this.ctx;

		var particle, vel, pos, t, lastt = -1;
		var maxp = MAX_PARTICLES;
		var maxc = MAX_NUM_COLORS;

		var particle = plist.root, data;

		while(particle != null) {

			data = particle.data;

			t = ((((data[2] * data[2]) + (data[3] * data[3])) / maxVel) * maxc) | 0;

			if(lastt != t) {
				ctx.fillStyle = lookup[t];
				lastt = t;
			}

			ctx.fillRect(data[0], data[1],
					 PARTICLE_SIZE, 
					 PARTICLE_SIZE);

			particle = particle.next;
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