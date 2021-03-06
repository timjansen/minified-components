/*
 * Welcome to Minfied Component's gruntfile :)
 * 
 * Here are some tasks that may be interesting for development:
 * 
 * - all: compiles and tests everything, sets up the /webContent dir that's used for the site
 * - code: compiles the code in /src, executes automated tests
 * - watch: watches over files, execute the tasks above automatically when files change
 * - server: starts a server on port 8081 that serves /webContent
 * 
 */ 

module.exports = function(grunt) {
	grunt.option('stack', true);
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		
		uglify: {
			dist: {
				options: {
					compress: {
						hoist_vars: true,
						unsafe: true
					},
					mangle: {
					}					
				},
				files: [{
					expand: true,
					cwd: 'src/',
					src: ['*.js'],
					dest: 'dist/'
				}]
			}
		},
	
		copy: {
			mocha: {
				files: {
					'webContent/test/mocha.js':     'node_modules/mocha/mocha.js',
					'webContent/test/mocha.css':    'node_modules/mocha/mocha.css'
				}
			},
			testCases: {
				files: [{
		            expand: true,
		            cwd: 'src/test',  
		            src: ['*.*'],
		            dest: 'webContent/test/'
			    }]
			},
			examples: {
				files: [{
		            expand: true,
		            cwd: 'src/examples',  
		            src: ['**/*.*'],
		            dest: 'webContent/examples/'
			    }]
			},
			exampleSrc: {
				files: [{
		            expand: true,
		            cwd: 'src',
		            src: ['*.*'],
		            dest: 'webContent/examples/'
			    }]
			},
			testSrc: {
				files: [{
		            expand: true,
		            cwd: 'src',
		            src: ['*.*'],
		            dest: 'webContent/test/'
			    }]
			},
			imgs: {
				files: [{
		            expand: true,
		            cwd: 'src/img',
		            src: ['*.*'],
		            dest: 'webContent/img/'
			    }]
			},
			dist: {
				files: [{
			        expand: true,
			        cwd: 'dist/',  
			        src: ['*.js'],
			        dest: 'webContent/'
			    }]
			}
		},

		clean: {
			tmp: ['tmp'],
			dist: ['dist'],
			web: ['webContent']
		},
		
 	    mocha: {
 	 		  all: {
 	  			options: {
 	  				run: true,
 	  				timeout: 5000
 	  			},
 	  			src: [ 'webContent/test/test-*.html' ]
 	  		  }
 	    },

		watch: {
			  code: {
				files: ['src/**/*.js', 'src/**/*.html'],
				tasks: ['code']
			  }
		},
		
		connect: {
		    server: {
		      options: {
		      	hostname: '*',
		        port: 8081,
		        base: 'webContent',
		        keepalive: true
		      }
		    }
		  }
	});
	
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-mocha');
	
	grunt.registerTask('code', ['uglify', 'copy', 'mocha']);
	grunt.registerTask('all', ['code']);
	grunt.registerTask('server', ['all', 'connect']);
	grunt.registerTask('default', ['code']);
	
};

