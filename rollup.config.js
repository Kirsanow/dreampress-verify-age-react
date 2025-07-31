import terser from '@rollup/plugin-terser';

export default [
    {
        input: 'scripts/age-estimator.js',
        output: [{
            file: 'build/age-estimator.js',
            format: 'es',
        }, {
            file: 'build/age-estimator.min.js',
            format: 'es',
            plugins: [
                terser({mangle: { keep_classnames: true, keep_fnames: true }}),
            ],
        }],
    },
    {
        input: 'scripts/dropin.js',
        output: [{
            file: 'build/dropin.js',
            format: 'iife',
        }, {
            file: 'build/dropin.min.js',
            format: 'iife',
            plugins: [
                terser({mangle: { keep_classnames: true, keep_fnames: true }}),
            ],
        }],
    }
];
