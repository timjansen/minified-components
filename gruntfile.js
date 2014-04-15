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
		
		clean: {
		
			tmp: ['tmp'],
			dist: ['dist']
		},
		
		watch: {
			  code: {
				files: ['src/*.js'],
				tasks: ['code']
			  }
		},
		
		connect: {
		    server: {
		      options: {
		        port: 8081,
		        base: 'webContent',
		        keepalive: true
		      }
		    }
		  }
	});
	
	grunt.loadTasks('build/tasks/');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-watch');
	
	grunt.registerTask('code', ['uglify', 'copy:dist']);
	grunt.registerTask('all', ['code']);
	grunt.registerTask('server', ['all', 'connect']);
	grunt.registerTask('default', ['code']);
	
};

