var Options = {
	//maxTrail: 48,
	forceGradient: 1.2,
	maxVel: 2.5,
	particleSize: 2,
};

var Vec = function(x, y) {
	this.x = x;
	this.y = y;
}

Vec.prototype = {
	add: function(other) {
		this.x += other.x;
		this.y += other.y;
	},

	mul: function(cons) {
		this.x *= cons;
		this.y *= cons;
	},

	mag: function() {
		return Math.sqrt((this.x * this.x) + (this.y * this.y));
	},

	magsq: function() {
		return (this.x * this.x) + (this.y * this.y)
	},

	clamp: function(val) {
		var mag = this.mag();
		if(mag > val) {
			var modifier = val / mag;
			this.x *= modifier;
			this.y *= modifier;
		}
	},

	clampsq: function(val) {
		val *= val;
		var mag = this.magsq();
		if(mag > val) {
			var modifier = val / mag;
			this.x *= modifier;
			this.y *= modifier;
		}
	},

	angle: function() {
		return Math.atan2(this.y, this.x);
	},

	clone: function() {
		return new Vec(this.x, this.y);
	}

}

Vec.fromAngle = function(angle, mag) {
	return new Vec(mag * Math.cos(angle), mag * Math.sin(angle));
}

var Particle = function(pos, vel, acc, damp) {
	this.pos = pos || new Vec(0, 0);
	this.vel = vel || new Vec(0, 0);
	this.acc = acc || new Vec(0, 0);
	this.damp = damp || 0;
	this.age = 0;
	this.maxAge = (Math.random() * 100) + 10000 | 0;
}

Particle.prototype = {
	move: function() {

		this.vel.add(this.acc);
		this.vel.clampsq(Options.maxVel);
		this.pos.add(this.vel);
		this.vel.mul(this.damp);
	},

	addField: function(fields) {
		var tAccX = 0;
		var tAccY = 0;


		for(var i = 0; i < fields.length; i++) {
			var field = fields[i];

			var dx = field.pos.x - this.pos.x;
			var dy = field.pos.y - this.pos.y;

			var force = field.mass / Math.pow(dx*dx + dy*dy, Options.forceGradient) * .6;

			tAccX += dx * force;
			tAccY += dy * force;

		}

		this.acc = new Vec(tAccX, tAccY);

		//this.acc.clampsq(1.0);
	}
}

var Emitter = function(pos, vel, spread) {
	this.pos = pos;
	this.vel = vel;
	//this.spread = spread || Math.PI / 32;
	this.spread = spread || Math.PI * 2;
	this.enabled = false;
}

Emitter.prototype = {
	emit: function() {
		var angle = this.vel.angle() + this.spread - (Math.random() * this.spread * 2);
		var mag = (this.vel.magsq()) * Math.random() * 0.3 + 0.1;
		var vel = Vec.fromAngle(angle, mag);

		//console.log('Emitt angle', vel);
		return new Particle(this.pos.clone(), vel, new Vec(0, 0), 0.9995);

	}
}

var Field = function(pos, mass) {
	this.pos = pos || new Vec(0, 0);
	this.mass = mass || 1.0;
}

var App = function(canvas) {
	this.cv = canvas;
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	this.ctx = canvas.getContext('2d');
	this.loopHandler = this.mainloop.bind(this);

	this.mode = 0;
	this.particles = [];
	this.fields = [];
	this.emitters = [
		new Emitter(new Vec(100, 230), Vec.fromAngle(0, 2))
	];

	var self = this;
	window.onmousemove = function(ev) {
		if(self.mode == 0) {
			self.emitters[0].pos.x = ev.pageX;
			self.emitters[0].pos.y = ev.pageY;
		} else {
			if(self.fields.length) {
				self.fields[0].pos.x = ev.pageX;
				self.fields[0].pos.y = ev.pageY;
			}
		}
	}

	window.onmousedown = function(ev) {
		if(self.mode == 0) {
			self.emitters[0].enabled = true;
		} else {
			self.fields = [];
			if(ev.button == 0) {
				self.fields.push(new Field(new Vec(ev.pageX, ev.pageY), 140));
			} else {
				self.fields.push(new Field(new Vec(ev.pageX, ev.pageY), -140));
			}
		}

		console.log("Particles: " + self.particles.length);
		ev.stopPropagation();
	}

	window.oncontextmenu = function(ev) {
		ev.stopPropagation();
		return false;
	}

	window.onmouseup = function(ev) {
		self.emitters[0].enabled = false;
		self.fields = [];
	}

	this.emissionRate = 15;
	this.maxParticles = 30000;

	this.ctx.fillStyle = "rgb(0, 0, 0)";
	this.ctx.fillRect(0, 0, this.cv.width, this.cv.height);
}

App.prototype = {
	//'add' or 'field'
	setmode: function(mode) {
		if(mode == 'add') {
			this.mode = 0;
		} else if(mode == 'field') {
			this.mode = 1;
		}
	},

	mainloop: function() {
		//console.log('rung', this.particles.length);

		this.clear();
		this.update();
		this.draw();
		this.queue();
	},

	clear: function() {
		this.ctx.save();
		this.ctx.globalCompositeOperation = 'multiply';
		this.ctx.fillStyle = 'rgb(238,238,238)';
		this.ctx.fillRect(0, 0, this.cv.width, this.cv.height);
		this.ctx.restore();
	},

	queue: function() {
		window.requestAnimationFrame(this.loopHandler)
	},

	update: function() {
		this._addParticles();
		this._updateParticles(this.cv.width, this.cv.height);
	},

	draw: function() {
		this._renderParticles();
	},

	_addParticles: function() {
		if(this.particles.length > this.maxParticles) {
			return;
		}

		for(var i = 0; i < this.emitters.length; i++) {
			var emitter = this.emitters[i];
			if(!emitter.enabled) {
				return;
			}

			for(var j = 0; j < this.emissionRate; j++) {
				this.particles.push(emitter.emit());
			}
		}
	},


	_updateParticles: function(maxX, maxY) {				
		for(var i = this.particles.length - 1; i >= 0 ; --i) {

			var particle = this.particles[i];
			var pos = particle.pos;

			if( pos.x < 0 || 
				pos.y < 0 || 
				pos.x > maxX || 
				pos.y > maxY) {

				this.particles.splice(i, 1);
				continue
			}

			if(this.fields.length) {
				particle.addField(this.fields);
			}

			particle.move();
			particle.age++;

		}
	},

	_interpolateRgb: function(r1, g1, b1, r2, g2, b2, t) {
		var r = (r1 + t * (r2 - r1)) | 0;
		var g = (g1 + t * (g2 - g1)) | 0;
		var b = (b1 + t * (b2 - b1)) | 0;

		return "rgb(" + r + ", " + g + ", " + b + ")";
	},

	_renderParticles: function() {

		var ctx = this.ctx;


		for(var p = 0; p < this.particles.length; p++) {

			var maxVel = Options.maxVel * Options.maxVel;
			var curVel = this.particles[p].vel.magsq();

			var t = curVel / maxVel;

			//ctx.fillStyle = this._interpolateRgb(11,72,107,  207,240,158,  t);
			//ctx.fillStyle = this._interpolateRgb(63,184,175,  255,61,127,  t);
			//ctx.fillStyle = this._interpolateRgb(218,214,202,  27,176,206,  t);
			ctx.fillStyle = this._interpolateRgb(204,12,57,  22,147,167,  t);
			var prev = this.particles[p].pos;
			ctx.fillRect(prev.x, prev.y, Options.particleSize, Options.particleSize);
		}
	}
}