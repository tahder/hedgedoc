import { NextFunction, Request, Response } from 'express'
import { config } from '../../config'

export function redirectWithoutTrailingSlashes (req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' && req.path.substr(-1) === '/' && req.path.length > 1) {
    const queryString: string = req.url.slice(req.path.length)
    const urlPath: string = req.path.slice(0, -1)
    let serverURL: string = config.serverURL
    if (config.urlPath) {
      serverURL = serverURL.slice(0, -(config.urlPath.length + 1))
    }
    res.redirect(301, serverURL + urlPath + queryString)
  } else {
    next()
  }
}
