

module.exports = function (grunt) {

    grunt.initConfig({

        mochaTest: {
            unit: {
                options: {
                    reporter: 'spec'
                },
                src: ['test/unit.js']
            }
        }
    });

    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.registerTask('test', ['mochaTest:unit']);

    grunt.registerTask('default', 'test');

};
