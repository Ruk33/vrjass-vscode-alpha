var exec = require('child_process').exec;

var process = exec('java -jar c:/users/ruke/intellij/vrj/build/libs/vrj.jar', function(error) {
    console.log('executed!');
    if (error !== null) {
        console.log('exec error: ' + error);
    }
});

var repeat = function() {
    console.log('Sending greeting');
    var name = { name: 'hello world' };
    process.stdin.write(JSON.stringify(name) + '\n');    
};

process.stdout.on('data', function(e) {
    console.log('out: ', e);
});

setInterval(repeat, 2000);