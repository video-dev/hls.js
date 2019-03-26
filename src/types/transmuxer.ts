import { RemuxerResult } from './remuxer';

export interface TransmuxerResult {
    remuxResult: RemuxerResult
    transmuxIdentifier: TransmuxIdentifier
}
export interface TransmuxIdentifier {
    sn: number
    level: number
}