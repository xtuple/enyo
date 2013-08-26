(function (enyo) {
	//*@protected
	/**
		As seen at https://gist.github.com/jcxplorer/823878, by jcxplorer.
		TODO: replace with faster implementation
	*/
	var uuid = function () {
		var uuid = "", idx = 0, rand;
		for (; idx < 32; ++idx) {
			rand = Math.random() * 16 | 0;
			if (idx == 8 || idx == 12 || idx == 16 || idx == 20) {
				uuid += "-";
			}
			uuid += (idx == 12? 4: (idx == 16? (rand & 3 | 8): rand)).toString(16);
		}
		return uuid;
	};
	//*@protected
	/**
		We create this reusable object for properties passed to the mixin
		method so as not to create and throw away a new object every time
		a new model is created.
	*/
	var _mixinOpts = {ignore: true};
	//*@public
	/**
		## Getting and Setting _enyo.Model_ values
	
		An _enyo.Model_ is a special object not derived from other enyo _kinds_. This is
		for efficiency and simplicity. That being said, any `set` or `get` call on a _model_
		will work only with the _schema_ of the _model_ and not as you would expect other
		kinds based on _enyo.Object_. Any property set via the `set` method will be assumed
		an `attribute` of the _model schema_. The `set` method also has the ability to accept
		a hash of _keys_ and _values_ to apply at once. Even though the schema is tracked via
		the `attributes` hash of the model it is __not necessary to prefix get/set paths with
		"attributes" as this is assumed and redundant and will cause it to created a nested
		schema object called `attributes`__. 
	
		TODO: add examples
	
		## Computed Properties and _enyo.Model_
	
		A _computed property_ is nothing more than a property whose value is the return value
		of a function. A _computed property_ of a _model_ is slightly different than that of
		_enyo.Object_ in that it cannot be cached or dependent on other properties. You declare
		a _computed property_ for a _model_ simply by setting the _attribute_ to a function. When
		requested as a normal attribute it will be the return value of that function executed in
		the context of the _model_ (the `this` value for that method). You cannot set the value of
		a computed property.

		## Bindings
	
		An _enyo.Model_ can be at the receiving end of a binding but bindings cannot be created
		on the _model_ itself. A _bindings_ array will be ignored.
	
		## Observers and Notifications
		
		## Events
	*/
	enyo.kind({
		name: "enyo.Model",
		//*@protected
		kind: null,
		noDefer: true,
		//*@public
		/**
			This is a hash of attributes known as the record's _schema_. This is where
			the values of any _attributes_ are stored for an active record.
		*/
		attributes: null,
		/**
			An optional hash of values and properties to be applied to the _attributes_
			of the record at initialization. Any values in the _defaults_ that already exists
			on the _attributes schema_ will be ignored.
		*/
		defaults: null,
		/**
			All _models_ have a _store_ reference. You can set this to a specific _store_
			instance in your application or use its default (the enyo.store global).
		*/
		store: null,
		/**
			An optional array of strings as the only properties to include in
			the _raw_ and _toJSON_ return values. By default it will use any properties
			in the _attributes_ hash.
		*/
		includeKeys: null,
		/**
			The `primaryKey` is the attribute that will be used if present in the model for
			reference in _enyo.Collections_ and in the _models_ _store_. It will also be used,
			by default, when generating the _url_ for the _model_. The value and property for
			`primaryKey` is stored on the attributes hash.
		*/
		primaryKey: "id",
		/**
			The `euid` is an arbitrarily assigned value that every _model_ has and is unique.
			Models can be requested via this property in _enyo.Collections_ and the _store_. This
			property, unlike the `primaryKey`, is stored on the _model_ and not its attributes hash.
		*/
		euid: "",
		/**
			Retrieve the requested _model attribute_. Will return the current value or
			undefined. If the attribute is a function it is assumed to be a computed property
			and will be called in the context of the model and its return value will be returned.
		*/
		get: function (prop) {
			var fn = this.attributes[prop];
			return (fn && "function" == typeof fn && fn.call(this)) || fn;
		},
		//*@public
		/**
			Will set a property or properties of the _model attribute(s)_. Accepts a property
			name and value or a single hash of _keys_ and _values_ to be set at once. Returns
			the _model_ for chaining. If the attribute being set is a function in the schema
			it will be ignored.
		*/
		set: function (prop, value) {
			if (enyo.isObject(prop)) { return this.setObject(prop); }
			var rv = this.attributes[prop];
			if (rv && "function" == typeof rv) { return this; }
			this.previous[prop] = rv;
			this.changed[prop] = this.attributes[prop] = value;
			this.notifyObservers();
			return this;
		},
		/**
			A _setter_ that accepts a hash of _key_/_value_ pairs. Returns the _model_
			for chaining (and consistency with `set`). All _keys_ in _props_ will be added
			to the `attributes` schema when this method is used.
		*/
		setObject: function (props) {
			var rv, k;
			for (k in props) {
				rv = this.attributes[k];
				if (rv && "function" == typeof rv) { continue; }
				this.previous[k] = rv;
				this.changed[k] = this.attributes[k] = props[k];
			}
			this.notifyObservers();
			return this;
		},
		/**
			While models should normally be instanced using _enyo.store.createRecord_,
			the same applies to the _constructor_, the first parameter will be used as
			attributes of the model, the second, optional parameter will be used as configuration
			for the _model_.
		*/
		constructor: function (attributes, opts) {
			if (opts) { this.importProps(opts); }
			this.storeChanged();
			var a = this.attributes? enyo.clone(this.attributes): {},
				d = this.defaults,
				x = attributes;
			if (x) {
				enyo.mixin(a, x);
			}
			if (d) {
				enyo.mixin(a, d, _mixinOpts);
			}
			this.attributes = a;
		},
		//*@protected
		importProps: function (props) {
			if (props) {
				if (props.defaults || props.attributes) { enyo.Model.subclass(this, props); }
				for (var k in props) {
					this[key] = props[k];
				}
			}
		},
		//*@public
		/**
			Produces an immutable hash of the known attributes of this record. Will
			be modified by the existence of the _includeKeys_ array otherwise it will
			use all known properties.
		*/
		raw: function () {
			var i = this.includeKeys,
				a = this.attributes;
			return i? enyo.only(i, a): enyo.clone(a);
		},
		/**
			Will return the JSON stringified version of the output of _raw_ of this record.
		*/
		toJSON: function () {
			return enyo.json.stringify(this.raw());
		},
		commit: function () {
		
		},
		fetch: function () {
		
		},
		destroy: function () {
		
		},
		didFetch: function () {
		
		},
		didCommit: function () {
		
		},
		didDestroy: function () {
		
		},
		//*@protected
		addObserver: function (prop, fn, ctx) {
			this.store.addModelObserver(this, prop, fn, ctx);
		},
		removeObserver: function () {
			this.store.removeModelObserver(this, prop, fn, ctx);
		},
		notifyObservers: function () {
			this.store.notifyModelObservers(this);
		},
		storeChanged: function () {
			var s = this.store || enyo.store;
			if (s) {
				if (enyo.isString(s)) {
					s = enyo.getPath(s);
					if (!s) {
						this.warn("could not find the requested store -> ", this.store, ", using" +
							"the default store");
					}
				}
			}
			s = this.store = s || enyo.store;
			s.addRecord(this);
		}
	});
	//*@protected
	enyo.Model.subclass = function (ctor, props) {
		var p  = ctor.prototype || ctor,
			ra = props.attributes,
			// only clone when we absolutely need to
			pa = (p.attributes && (ra && enyo.clone(p.attributes)) || p.attributes) || {},
			rd = props.defaults,
			// only clone when we absolutely need to
			pd = (p.defaults && (rd && enyo.clone(p.defaults)) || p.defaults) || {};
			
		// handle attributes of the kind so all subkinds will accurately
		// have the mixture of the schema
		if (ra) { enyo.mixin(pa, ra) && (delete props.attributes); }
		// always assign the prototype's attributes
		p.attributes = pa;
		// handle defaults of the kind so all subkinds will accurately
		// have the mixture of the defaults
		if (rd) { enyo.mixin(pd, rd) && (delete props.defaults); }
		// always assign the prototype's defaults
		p.defaults = pd;
	};
})(enyo);