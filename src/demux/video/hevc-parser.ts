/*
 * Copyright (C) 2022 もにょてっく. All Rights Reserved.
 *
 * @author もにょ〜ん <monyone.teihen@gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import ExpGolomb from './exp-golomb';

class H265Parser {
    static _ebsp2rbsp(uint8array) {
        const src = uint8array;
        const src_length = src.byteLength;
        const dst = new Uint8Array(src_length);
        let dst_idx = 0;

        for (let i = 0; i < src_length; i++) {
            if (i >= 2) {
                // Unescape: Skip 0x03 after 00 00
                if (src[i] === 0x03 && src[i - 1] === 0x00 && src[i - 2] === 0x00) {
                    continue;
                }
            }
            dst[dst_idx] = src[i];
            dst_idx++;
        }

        return new Uint8Array(dst.buffer, 0, dst_idx);
    }

    static parseVPS(uint8array) {
        const rbsp = H265Parser._ebsp2rbsp(uint8array);
        const gb = new ExpGolomb(rbsp);

        /* remove NALu Header */
        gb.readUByte();
        gb.readUByte();

        // VPS
        const video_parameter_set_id = gb.readBits(4);
        gb.readBits(2);
        const max_layers_minus1 = gb.readBits(6);
        const max_sub_layers_minus1 = gb.readBits(3);
        const temporal_id_nesting_flag = gb.readBoolean();
        // and more ...

        return {
            num_temporal_layers: max_sub_layers_minus1 + 1,
            temporal_id_nested: temporal_id_nesting_flag,
        };
    }

    static parseSPS(uint8array) {
        const rbsp = H265Parser._ebsp2rbsp(uint8array);
        let gb = new ExpGolomb(rbsp);

        /* remove NALu Header */
        gb.readUByte();
        gb.readUByte();

        let left_offset = 0,
            right_offset = 0,
            top_offset = 0,
            bottom_offset = 0;

        // SPS
        const video_paramter_set_id = gb.readBits(4);
        const max_sub_layers_minus1 = gb.readBits(3);
        const temporal_id_nesting_flag = gb.readBoolean();

        // profile_tier_level begin
        const general_profile_space = gb.readBits(2);
        const general_tier_flag = gb.readBoolean();
        const general_profile_idc = gb.readBits(5);
        const general_profile_compatibility_flags_1 = gb.readUByte();
        const general_profile_compatibility_flags_2 = gb.readUByte();
        const general_profile_compatibility_flags_3 = gb.readUByte();
        const general_profile_compatibility_flags_4 = gb.readUByte();
        const general_constraint_indicator_flags_1 = gb.readUByte();
        const general_constraint_indicator_flags_2 = gb.readUByte();
        const general_constraint_indicator_flags_3 = gb.readUByte();
        const general_constraint_indicator_flags_4 = gb.readUByte();
        const general_constraint_indicator_flags_5 = gb.readUByte();
        const general_constraint_indicator_flags_6 = gb.readUByte();
        const general_level_idc = gb.readUByte();
        const sub_layer_profile_present_flag = [] as any[];
        const sub_layer_level_present_flag = [] as any[];
        for (let i = 0; i < max_sub_layers_minus1; i++) {
            sub_layer_profile_present_flag.push(gb.readBoolean());
            sub_layer_level_present_flag.push(gb.readBoolean() as any);
        }
        if (max_sub_layers_minus1 > 0) {
            for (let i = max_sub_layers_minus1; i < 8; i++) {
                gb.readBits(2);
            }
        }
        for (let i = 0; i < max_sub_layers_minus1; i++) {
            if (sub_layer_profile_present_flag[i]) {
                gb.readUByte(); // sub_layer_profile_space, sub_layer_tier_flag, sub_layer_profile_idc
                gb.readUByte();
                gb.readUByte();
                gb.readUByte();
                gb.readUByte(); // sub_layer_profile_compatibility_flag
                gb.readUByte();
                gb.readUByte();
                gb.readUByte();
                gb.readUByte();
                gb.readUByte();
                gb.readUByte();
            }
            if (sub_layer_level_present_flag[i]) {
                gb.readUByte();
            }
        }
        // profile_tier_level end

        const seq_parameter_set_id = gb.readUEG();
        const chroma_format_idc = gb.readUEG();
        if (chroma_format_idc == 3) {
            gb.readBits(1); // separate_colour_plane_flag
        }
        const pic_width_in_luma_samples = gb.readUEG();
        const pic_height_in_luma_samples = gb.readUEG();
        const conformance_window_flag = gb.readBoolean();
        if (conformance_window_flag) {
            left_offset += gb.readUEG();
            right_offset += gb.readUEG();
            top_offset += gb.readUEG();
            bottom_offset += gb.readUEG();
        }
        const bit_depth_luma_minus8 = gb.readUEG();
        const bit_depth_chroma_minus8 = gb.readUEG();
        const log2_max_pic_order_cnt_lsb_minus4 = gb.readUEG();
        const sub_layer_ordering_info_present_flag = gb.readBoolean();
        for (
            let i = sub_layer_ordering_info_present_flag ? 0 : max_sub_layers_minus1;
            i <= max_sub_layers_minus1;
            i++
        ) {
            gb.readUEG(); // max_dec_pic_buffering_minus1[i]
            gb.readUEG(); // max_num_reorder_pics[i]
            gb.readUEG(); // max_latency_increase_plus1[i]
        }
        const log2_min_luma_coding_block_size_minus3 = gb.readUEG();
        const log2_diff_max_min_luma_coding_block_size = gb.readUEG();
        const log2_min_transform_block_size_minus2 = gb.readUEG();
        const log2_diff_max_min_transform_block_size = gb.readUEG();
        const max_transform_hierarchy_depth_inter = gb.readUEG();
        const max_transform_hierarchy_depth_intra = gb.readUEG();
        const scaling_list_enabled_flag = gb.readBoolean();
        if (scaling_list_enabled_flag) {
            const sps_scaling_list_data_present_flag = gb.readBoolean();
            if (sps_scaling_list_data_present_flag) {
                for (let sizeId = 0; sizeId < 4; sizeId++) {
                    for (
                        let matrixId = 0;
                        matrixId < (sizeId === 3 ? 2 : 6);
                        matrixId++
                    ) {
                        const scaling_list_pred_mode_flag = gb.readBoolean();
                        if (!scaling_list_pred_mode_flag) {
                            gb.readUEG(); // scaling_list_pred_matrix_id_delta
                        } else {
                            const coefNum = Math.min(64, 1 << (4 + (sizeId << 1)));
                            if (sizeId > 1) {
                                gb.readEG();
                            }
                            for (let i = 0; i < coefNum; i++) {
                                gb.readEG();
                            }
                        }
                    }
                }
            }
        }
        const amp_enabled_flag = gb.readBoolean();
        const sample_adaptive_offset_enabled_flag = gb.readBoolean();
        const pcm_enabled_flag = gb.readBoolean();
        if (pcm_enabled_flag) {
            gb.readUByte();
            gb.readUEG();
            gb.readUEG();
            gb.readBoolean();
        }
        const num_short_term_ref_pic_sets = gb.readUEG();
        let num_delta_pocs = 0;
        for (let i = 0; i < num_short_term_ref_pic_sets; i++) {
            let inter_ref_pic_set_prediction_flag = false;
            if (i !== 0) {
                inter_ref_pic_set_prediction_flag = gb.readBoolean();
            }
            if (inter_ref_pic_set_prediction_flag) {
                if (i === num_short_term_ref_pic_sets) {
                    gb.readUEG();
                }
                gb.readBoolean();
                gb.readUEG();
                let next_num_delta_pocs = 0;
                for (let j = 0; j <= num_delta_pocs; j++) {
                    const used_by_curr_pic_flag = gb.readBoolean();
                    let use_delta_flag = false;
                    if (!used_by_curr_pic_flag) {
                        use_delta_flag = gb.readBoolean();
                    }
                    if (used_by_curr_pic_flag || use_delta_flag) {
                        next_num_delta_pocs++;
                    }
                }
                num_delta_pocs = next_num_delta_pocs;
            } else {
                const num_negative_pics = gb.readUEG();
                const num_positive_pics = gb.readUEG();
                num_delta_pocs = num_negative_pics + num_positive_pics;
                for (let j = 0; j < num_negative_pics; j++) {
                    gb.readUEG();
                    gb.readBoolean();
                }
                for (let j = 0; j < num_positive_pics; j++) {
                    gb.readUEG();
                    gb.readBoolean();
                }
            }
        }
        const long_term_ref_pics_present_flag = gb.readBoolean();
        if (long_term_ref_pics_present_flag) {
            const num_long_term_ref_pics_sps = gb.readUEG();
            for (let i = 0; i < num_long_term_ref_pics_sps; i++) {
                for (let j = 0; j < log2_max_pic_order_cnt_lsb_minus4 + 4; j++) {
                    gb.readBits(1);
                }
                gb.readBits(1);
            }
        }
        //*
        let default_display_window_flag = false; // for calc offset
        let min_spatial_segmentation_idc = 0; // for hvcC
        let sar_width = 1,
            sar_height = 1;
        let fps_fixed = false,
            fps_den = 1,
            fps_num = 1;
        //*/
        const sps_temporal_mvp_enabled_flag = gb.readBoolean();
        const strong_intra_smoothing_enabled_flag = gb.readBoolean();
        const vui_parameters_present_flag = gb.readBoolean();
        if (vui_parameters_present_flag) {
            const aspect_ratio_info_present_flag = gb.readBoolean();
            if (aspect_ratio_info_present_flag) {
                const aspect_ratio_idc = gb.readUByte();

                const sar_w_table = [
                    1,
                    12,
                    10,
                    16,
                    40,
                    24,
                    20,
                    32,
                    80,
                    18,
                    15,
                    64,
                    160,
                    4,
                    3,
                    2,
                ];
                const sar_h_table = [
                    1,
                    11,
                    11,
                    11,
                    33,
                    11,
                    11,
                    11,
                    33,
                    11,
                    11,
                    33,
                    99,
                    3,
                    2,
                    1,
                ];

                if (aspect_ratio_idc > 0 && aspect_ratio_idc <= 16) {
                    sar_width = sar_w_table[aspect_ratio_idc - 1];
                    sar_height = sar_h_table[aspect_ratio_idc - 1];
                } else if (aspect_ratio_idc === 255) {
                    sar_width = gb.readBits(16);
                    sar_height = gb.readBits(16);
                }
            }
            const overscan_info_present_flag = gb.readBoolean();
            if (overscan_info_present_flag) {
                gb.readBoolean();
            }
            const video_signal_type_present_flag = gb.readBoolean();
            if (video_signal_type_present_flag) {
                gb.readBits(3);
                gb.readBoolean();
                const colour_description_present_flag = gb.readBoolean();
                if (colour_description_present_flag) {
                    gb.readUByte();
                    gb.readUByte();
                    gb.readUByte();
                }
            }
            const chroma_loc_info_present_flag = gb.readBoolean();
            if (chroma_loc_info_present_flag) {
                gb.readUEG();
                gb.readUEG();
            }
            const neutral_chroma_indication_flag = gb.readBoolean();
            const field_seq_flag = gb.readBoolean();
            const frame_field_info_present_flag = gb.readBoolean();
            default_display_window_flag = gb.readBoolean();
            if (default_display_window_flag) {
                gb.readUEG();
                gb.readUEG();
                gb.readUEG();
                gb.readUEG();
            }
            const vui_timing_info_present_flag = gb.readBoolean();
            if (vui_timing_info_present_flag) {
                fps_den = gb.readBits(32);
                fps_num = gb.readBits(32);
                const vui_poc_proportional_to_timing_flag = gb.readBoolean();
                if (vui_poc_proportional_to_timing_flag) {
                    gb.readUEG();
                }
                const vui_hrd_parameters_present_flag = gb.readBoolean();
                if (vui_hrd_parameters_present_flag) {
                    const commonInfPresentFlag = 1;
                    let nal_hrd_parameters_present_flag = false;
                    let vcl_hrd_parameters_present_flag = false;
                    let sub_pic_hrd_params_present_flag = false;
                    if (commonInfPresentFlag) {
                        nal_hrd_parameters_present_flag = gb.readBoolean();
                        vcl_hrd_parameters_present_flag = gb.readBoolean();
                        if (
                            nal_hrd_parameters_present_flag ||
                            vcl_hrd_parameters_present_flag
                        ) {
                            sub_pic_hrd_params_present_flag = gb.readBoolean();
                            if (sub_pic_hrd_params_present_flag) {
                                gb.readUByte();
                                gb.readBits(5);
                                gb.readBoolean();
                                gb.readBits(5);
                            }
                            const bit_rate_scale = gb.readBits(4);
                            const cpb_size_scale = gb.readBits(4);
                            if (sub_pic_hrd_params_present_flag) {
                                gb.readBits(4);
                            }
                            gb.readBits(5);
                            gb.readBits(5);
                            gb.readBits(5);
                        }
                    }
                    for (let i = 0; i <= max_sub_layers_minus1; i++) {
                        const fixed_pic_rate_general_flag = gb.readBoolean();
                        fps_fixed = fixed_pic_rate_general_flag;
                        let fixed_pic_rate_within_cvs_flag = true;
                        let cpbCnt = 1;
                        if (!fixed_pic_rate_general_flag) {
                            fixed_pic_rate_within_cvs_flag = gb.readBoolean();
                        }
                        let low_delay_hrd_flag = false;
                        if (fixed_pic_rate_within_cvs_flag) {
                            gb.readUEG();
                        } else {
                            low_delay_hrd_flag = gb.readBoolean();
                        }
                        if (!low_delay_hrd_flag) {
                            cpbCnt = gb.readUEG() + 1;
                        }
                        if (nal_hrd_parameters_present_flag) {
                            for (let j = 0; j < cpbCnt; j++) {
                                gb.readUEG();
                                gb.readUEG();
                                if (sub_pic_hrd_params_present_flag) {
                                    gb.readUEG();
                                    gb.readUEG();
                                }
                            }
                            gb.readBoolean();
                        }
                        if (vcl_hrd_parameters_present_flag) {
                            for (let j = 0; j < cpbCnt; j++) {
                                gb.readUEG();
                                gb.readUEG();
                                if (sub_pic_hrd_params_present_flag) {
                                    gb.readUEG();
                                    gb.readUEG();
                                }
                            }
                            gb.readBoolean();
                        }
                    }
                }
            }
            const bitstream_restriction_flag = gb.readBoolean();
            if (bitstream_restriction_flag) {
                const tiles_fixed_structure_flag = gb.readBoolean();
                const motion_vectors_over_pic_boundaries_flag = gb.readBoolean();
                const restricted_ref_pic_lists_flag = gb.readBoolean();
                min_spatial_segmentation_idc = gb.readUEG();
                const max_bytes_per_pic_denom = gb.readUEG();
                const max_bits_per_min_cu_denom = gb.readUEG();
                const log2_max_mv_length_horizontal = gb.readUEG();
                const log2_max_mv_length_vertical = gb.readUEG();
            }
        }
        const sps_extension_flag = gb.readBoolean(); // ignore...
        // for meta data
        const codec_mimetype = `hvc1.${general_profile_idc}.1.L${general_level_idc}.B0`;

        const sub_wc = chroma_format_idc === 1 || chroma_format_idc === 2 ? 2 : 1;
        const sub_hc = chroma_format_idc === 1 ? 2 : 1;
        const codec_width =
            pic_width_in_luma_samples - (left_offset + right_offset) * sub_wc;
        const codec_height =
            pic_height_in_luma_samples - (top_offset + bottom_offset) * sub_hc;
        let sar_scale = 1;
        if (sar_width !== 1 && sar_height !== 1) {
            sar_scale = sar_width / sar_height;
        }

        gb.destroy();
        gb = null as any;

        return {
            codec_mimetype,
            level_string: H265Parser.getLevelString(general_level_idc),
            profile_idc: general_profile_idc,
            bit_depth: bit_depth_luma_minus8 + 8,
            ref_frames: 1, // FIXME!!!
            chroma_format: chroma_format_idc,
            chroma_format_string: H265Parser.getChromaFormatString(
                chroma_format_idc
            ),

            general_level_idc,
            general_profile_space,
            general_tier_flag,
            general_profile_idc,
            general_profile_compatibility_flags_1,
            general_profile_compatibility_flags_2,
            general_profile_compatibility_flags_3,
            general_profile_compatibility_flags_4,
            general_constraint_indicator_flags_1,
            general_constraint_indicator_flags_2,
            general_constraint_indicator_flags_3,
            general_constraint_indicator_flags_4,
            general_constraint_indicator_flags_5,
            general_constraint_indicator_flags_6,
            min_spatial_segmentation_idc,
            constant_frame_rate: 0 /* FIXME!! fps_fixed ? 1 : 0? */,
            chroma_format_idc,
            bit_depth_luma_minus8,
            bit_depth_chroma_minus8,

            frame_rate: {
                fixed: fps_fixed,
                fps: fps_num / fps_den,
                fps_den: fps_den,
                fps_num: fps_num,
            },

            sar_ratio: {
                width: sar_width,
                height: sar_height,
            },

            codec_size: {
                width: codec_width,
                height: codec_height,
            },

            present_size: {
                width: codec_width * sar_scale,
                height: codec_height,
            },
        };
    }

    static parsePPS(uint8array) {
        const rbsp = H265Parser._ebsp2rbsp(uint8array);
        const gb = new ExpGolomb(rbsp);

        /* remove NALu Header */
        gb.readUByte();
        gb.readUByte();

        const pic_parameter_set_id = gb.readUEG();
        const seq_parameter_set_id = gb.readUEG();
        const dependent_slice_segments_enabled_flag = gb.readBoolean();
        const output_flag_present_flag = gb.readBoolean();
        const num_extra_slice_header_bits = gb.readBits(3);
        const sign_data_hiding_enabled_flag = gb.readBoolean();
        const cabac_init_present_flag = gb.readBoolean();
        const num_ref_idx_l0_default_active_minus1 = gb.readUEG();
        const num_ref_idx_l1_default_active_minus1 = gb.readUEG();
        const init_qp_minus26 = gb.readEG();
        const constrained_intra_pred_flag = gb.readBoolean();
        const transform_skip_enabled_flag = gb.readBoolean();
        const cu_qp_delta_enabled_flag = gb.readBoolean();
        if (cu_qp_delta_enabled_flag) {
            const diff_cu_qp_delta_depth = gb.readUEG();
        }
        const cb_qp_offset = gb.readEG();
        const cr_qp_offset = gb.readEG();
        const pps_slice_chroma_qp_offsets_present_flag = gb.readBoolean();
        const weighted_pred_flag = gb.readBoolean();
        const weighted_bipred_flag = gb.readBoolean();
        const transquant_bypass_enabled_flag = gb.readBoolean();
        const tiles_enabled_flag = gb.readBoolean();
        const entropy_coding_sync_enabled_flag = gb.readBoolean();
        // and more ...

        // needs hvcC
        let parallelismType = 1; // slice-based parallel decoding
        if (entropy_coding_sync_enabled_flag && tiles_enabled_flag) {
            parallelismType = 0; // mixed-type parallel decoding
        } else if (entropy_coding_sync_enabled_flag) {
            parallelismType = 3; // wavefront-based parallel decoding
        } else if (tiles_enabled_flag) {
            parallelismType = 2; // tile-based parallel decoding
        }

        return {
            parallelismType,
        };
    }

    static getChromaFormatString(chroma_idc) {
        switch (chroma_idc) {
            case 0:
                return '4:0:0';
            case 1:
                return '4:2:0';
            case 2:
                return '4:2:2';
            case 3:
                return '4:4:4';
            default:
                return 'Unknown';
        }
    }

    static getProfileString(profile_idc) {
        switch (profile_idc) {
            case 1:
                return 'Main';
            case 2:
                return 'Main10';
            case 3:
                return 'MainSP';
            case 4:
                return 'Rext';
            case 9:
                return 'SCC';
            default:
                return 'Unknown';
        }
    }

    static getLevelString(level_idc) {
        return (level_idc / 30).toFixed(1);
    }
}

export default H265Parser;
