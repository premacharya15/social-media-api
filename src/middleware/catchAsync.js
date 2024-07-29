export default function catchAsync(errorFunction) {
    return (req, res, next) => {
        Promise.resolve(errorFunction(req, res, next)).catch(next);
    };
}