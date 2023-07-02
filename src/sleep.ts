
export const sleep = (ms: number) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(0), ms)
  })
}