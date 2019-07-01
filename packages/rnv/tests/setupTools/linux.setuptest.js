import shell from 'shelljs';

it('Lists no emulators', async () => {
    const output = await shell.exec('rnv target list -p android --ci');
    expect(output.stdout).toMatch('No devices found');
});
