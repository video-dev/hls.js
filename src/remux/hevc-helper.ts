export type HEVCDecoderConfigurationRecordType = {
    configurationVersion: 1;
} & VPSHEVCDecoderConfigurationRecordType & SPSHEVCDecoderConfigurationRecordType & PPSHEVCDecoderConfigurationRecordType;

export type VPSHEVCDecoderConfigurationRecordType = {
    num_temporal_layers: number;
    temporal_id_nested: boolean;
}

export type SPSHEVCDecoderConfigurationRecordType = {
    general_profile_space: number;
    general_tier_flag: number;
    general_level_idc: number;
    general_profile_idc: number;
    general_profile_compatibility_flags_1: number;
    general_profile_compatibility_flags_2: number;
    general_profile_compatibility_flags_3: number;
    general_profile_compatibility_flags_4: number;
    general_constraint_indicator_flags_1: number;
    general_constraint_indicator_flags_2: number;
    general_constraint_indicator_flags_3: number;
    general_constraint_indicator_flags_4: number;
    general_constraint_indicator_flags_5: number;
    general_constraint_indicator_flags_6: number;
    constant_frame_rate: number;
    min_spatial_segmentation_idc: number;
    chroma_format_idc: number,
    bit_depth_luma_minus8: number,
    bit_depth_chroma_minus8: number,
}

export type PPSHEVCDecoderConfigurationRecordType = {
    parallelismType: number;
}
export class HEVCDecoderConfigurationRecord {

    private data: Uint8Array;

    // sps, pps: require Nalu without 4 byte length-header
    public constructor(vps: Uint8Array, sps: Uint8Array, pps: Uint8Array, detail: HEVCDecoderConfigurationRecordType) {
        const length = 23 + (3 + 2 + vps.byteLength) + (3 + 2 + sps.byteLength) + (3 + 2 + pps.byteLength);
        const data = this.data = new Uint8Array(length);

        data[0] = 0x01; // configurationVersion
        data[1] = ((detail.general_profile_space & 0x03) << 6) | ((detail.general_tier_flag ? 1 : 0) << 5) | ((detail.general_profile_idc & 0x1F));
        data[2] = detail.general_profile_compatibility_flags_1;
        data[3] = detail.general_profile_compatibility_flags_2;
        data[4] = detail.general_profile_compatibility_flags_3;
        data[5] = detail.general_profile_compatibility_flags_4;
        data[6] = detail.general_constraint_indicator_flags_1;
        data[7] = detail.general_constraint_indicator_flags_2;
        data[8] = detail.general_constraint_indicator_flags_3;
        data[9] = detail.general_constraint_indicator_flags_4;
        data[10] = detail.general_constraint_indicator_flags_5;
        data[11] = detail.general_constraint_indicator_flags_6;
        data[12] = detail.general_level_idc;
        data[13] = 0xF0 | ((detail.min_spatial_segmentation_idc & 0x0F00) >> 8)
        data[14] = (detail.min_spatial_segmentation_idc & 0xFF);
        data[15] = 0xFC | (detail.parallelismType & 0x03);
        data[16] = 0xFC | (detail.chroma_format_idc & 0x03);
        data[17] = 0xF8 | (detail.bit_depth_luma_minus8 & 0x07);
        data[18] = 0xF8 | (detail.bit_depth_chroma_minus8 & 0x07);
        data[19] = 0;
        data[20] = 0;
        data[21] = ((detail.constant_frame_rate & 0x03) << 6) | ((detail.num_temporal_layers & 0x07) << 3) | ((detail.temporal_id_nested ? 1 : 0) << 2) | 3;
        data[22] = 3;
        data[23 + 0 + 0] = 0x80 | 32;
        data[23 + 0 + 1] = 0;
        data[23 + 0 + 2] = 1;
        data[23 + 0 + 3] = (vps.byteLength & 0xFF00) >> 8;
        data[23 + 0 + 4] = (vps.byteLength & 0x00FF) >> 0;
        data.set(vps, 23 + 0 + 5);
        data[23 + (5 + vps.byteLength) + 0] = 0x80 | 33;
        data[23 + (5 + vps.byteLength) + 1] = 0;
        data[23 + (5 + vps.byteLength) + 2] = 1;
        data[23 + (5 + vps.byteLength) + 3] = (sps.byteLength & 0xFF00) >> 8;
        data[23 + (5 + vps.byteLength) + 4] = (sps.byteLength & 0x00FF) >> 0;
        data.set(sps, 23 + (5 + vps.byteLength) + 5);
        data[23 + (5 + vps.byteLength + 5 + sps.byteLength) + 0] = 0x80 | 34;
        data[23 + (5 + vps.byteLength + 5 + sps.byteLength) + 1] = 0;
        data[23 + (5 + vps.byteLength + 5 + sps.byteLength) + 2] = 1;
        data[23 + (5 + vps.byteLength + 5 + sps.byteLength) + 3] = (pps.byteLength & 0xFF00) >> 8;
        data[23 + (5 + vps.byteLength + 5 + sps.byteLength) + 4] = (pps.byteLength & 0x00FF) >> 0;
        data.set(pps, 23 + (5 + vps.byteLength + 5 + sps.byteLength) + 5);
    }

    public getData() {
        return this.data;
    }

}
