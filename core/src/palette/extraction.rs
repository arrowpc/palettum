use image::Rgb;

use super::Palette;
use crate::{
    color::{ConvertToLab, Lab},
    error::{Error, Result},
    media::{Gif, Ico, Image, Media},
};

impl Palette {
    pub fn from_media(media: &Media, k_colors: usize) -> Result<Self> {
        match media {
            Media::Gif(gif) => Palette::from_gif(gif, k_colors),
            Media::Ico(ico) => Palette::from_ico(ico, k_colors),
            Media::Image(img) => Palette::from_image(img, k_colors),
            &Media::Video(_) => todo!(),
        }
    }

    pub fn from_gif(gif: &Gif, k_colors: usize) -> Result<Self> {
        let mut lab_pixels: Vec<Lab> = Vec::new();

        for frame in &gif.frames {
            for pixel_data in frame.buffer().pixels() {
                lab_pixels.push(pixel_data.to_lab());
            }
        }

        let extracted_colors = Self::extract_colors_from_lab_pixels(&lab_pixels, k_colors)?;

        Ok(Self::builder()
            .colors(extracted_colors)
            .source("extracted from GIF".to_string())
            .build())
    }

    pub fn from_ico(ico: &Ico, k_colors: usize) -> Result<Self> {
        let mut lab_pixels: Vec<Lab> = Vec::new();

        for buffer in &ico.buffers {
            if buffer.is_empty() {
                continue;
            }
            for pixel_data in buffer.pixels() {
                lab_pixels.push(pixel_data.to_lab());
            }
        }

        let extracted_colors = Self::extract_colors_from_lab_pixels(&lab_pixels, k_colors)?;

        Ok(Self::builder()
            .colors(extracted_colors)
            .source("extracted from icon".to_string())
            .build())
    }

    pub fn from_image(image: &Image, k_colors: usize) -> Result<Self> {
        let mut lab_pixels: Vec<Lab> = Vec::with_capacity((image.width * image.height) as usize);
        for pixel_data in image.buffer.pixels() {
            lab_pixels.push(pixel_data.to_lab());
        }

        let extracted_colors = Self::extract_colors_from_lab_pixels(&lab_pixels, k_colors)?;

        Ok(Self::builder()
            .colors(extracted_colors)
            .source("extracted from image".to_string())
            .build())
    }

    fn extract_colors_from_lab_pixels(
        lab_pixels: &[Lab],
        mut k_colors: usize,
    ) -> Result<Vec<Rgb<u8>>> {
        if lab_pixels.is_empty() || k_colors == 0 {
            return Err(Error::InvalidPaletteFromMedia);
        }

        if k_colors > MAX_COLORS {
            log::warn!("255 is the maximum palette size, clamping to max");
            k_colors = MAX_COLORS;
        }

        let table_1d_size = MOMENT_TABLE_DIM * MOMENT_TABLE_DIM * MOMENT_TABLE_DIM;
        let mut weights = vec![0.0; table_1d_size];
        let mut sum_l = vec![0.0; table_1d_size];
        let mut sum_a = vec![0.0; table_1d_size];
        let mut sum_b = vec![0.0; table_1d_size];
        let mut sum_l2_a2_b2 = vec![0.0; table_1d_size];

        build_raw_histogram_for_palette(
            lab_pixels,
            &mut weights,
            &mut sum_l,
            &mut sum_a,
            &mut sum_b,
            &mut sum_l2_a2_b2,
        );
        compute_cumulative_moments(
            &mut weights,
            &mut sum_l,
            &mut sum_a,
            &mut sum_b,
            &mut sum_l2_a2_b2,
        );

        let mut cubes = Vec::with_capacity(k_colors);
        cubes.push(ColorBox {
            l0: 0,
            a0: 0,
            b0: 0,
            l1: HIST_DIM,
            a1: HIST_DIM,
            b1: HIST_DIM,
            volume_cells: HIST_DIM.pow(3),
        });

        let mut variances = vec![0.0f32; k_colors];
        variances[0] = if cubes[0].volume_cells > 1 {
            calculate_box_variance(&cubes[0], &weights, &sum_l, &sum_a, &sum_b, &sum_l2_a2_b2)
                as f32
        } else {
            0.0
        };

        for i in 1..k_colors {
            let mut next_to_split_idx = 0;
            let mut max_variance = -1.0f32;
            if let Some((j, &variance)) = variances
                .iter()
                .take(i)
                .enumerate()
                .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            {
                max_variance = variance;
                next_to_split_idx = j;
            }

            if max_variance <= 0.0 {
                k_colors = i;
                break;
            }

            let box_to_split = cubes[next_to_split_idx];
            if let Some((b1, b2)) = split_box(&box_to_split, &weights, &sum_l, &sum_a, &sum_b) {
                cubes[next_to_split_idx] = b1;
                cubes.push(b2);
                variances[next_to_split_idx] = if b1.volume_cells > 1 {
                    calculate_box_variance(&b1, &weights, &sum_l, &sum_a, &sum_b, &sum_l2_a2_b2)
                        as f32
                } else {
                    0.0
                };
                variances[i] = if b2.volume_cells > 1 {
                    calculate_box_variance(&b2, &weights, &sum_l, &sum_a, &sum_b, &sum_l2_a2_b2)
                        as f32
                } else {
                    0.0
                };
            } else {
                variances[next_to_split_idx] = 0.0;
                k_colors = i;
                break;
            }
        }
        cubes.truncate(k_colors);

        let mut colors = Vec::with_capacity(k_colors);
        for k_idx in 0..k_colors {
            let w = calculate_sum_in_box(&cubes[k_idx], &weights);
            if w > 0.0 {
                colors.push(
                    Lab {
                        l: (calculate_sum_in_box(&cubes[k_idx], &sum_l) / w) as f32,
                        a: (calculate_sum_in_box(&cubes[k_idx], &sum_a) / w) as f32,
                        b: (calculate_sum_in_box(&cubes[k_idx], &sum_b) / w) as f32,
                    }
                    .to_rgb(),
                );
            } else if !cubes.is_empty() && cubes[k_idx].volume_cells > 0 {
                colors.push(
                    Lab {
                        l: 0.0,
                        a: 0.0,
                        b: 0.0,
                    }
                    .to_rgb(),
                );
            }
        }
        Ok(colors)
    }
}
// --- Wu's Color Quantizer ---
#[derive(Debug, Clone, Copy)]
struct ColorBox {
    l0: usize,
    a0: usize,
    b0: usize, // Min values (exclusive index in moment table, 0 to HIST_DIM-1)
    l1: usize,
    a1: usize,
    b1: usize,           // Max values (inclusive index in moment table, 1 to HIST_DIM)
    volume_cells: usize, // Geometric volume in terms of histogram cells
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ColorAxis {
    L,
    A,
    B,
}

// Constants for quantization algorithm
const HIST_DIM: usize = 32; // Number of bins per dimension
const MOMENT_TABLE_DIM: usize = HIST_DIM + 1; // Size of moment table dimensions
const MAX_COLORS: usize = 255; // Maximum number of colors in the palette

// Lab color component ranges for quantization
const L_COMPONENT_MIN: f32 = 0.0;
const L_COMPONENT_MAX: f32 = 100.0;
const A_COMPONENT_MIN: f32 = -128.0; // Typical range for a*
const A_COMPONENT_MAX: f32 = 127.0; // Typical range for a*
const B_COMPONENT_MIN: f32 = -128.0; // Typical range for b*
const B_COMPONENT_MAX: f32 = 127.0; // Typical range for b*

#[inline(always)]
fn get_table_idx(l_idx: usize, a_idx: usize, b_idx: usize) -> usize {
    debug_assert!(l_idx < MOMENT_TABLE_DIM);
    debug_assert!(a_idx < MOMENT_TABLE_DIM);
    debug_assert!(b_idx < MOMENT_TABLE_DIM);
    l_idx * MOMENT_TABLE_DIM * MOMENT_TABLE_DIM + a_idx * MOMENT_TABLE_DIM + b_idx
}

fn map_value_to_hist_bin_idx(val: f32, min_val: f32, max_val: f32) -> usize {
    if val <= min_val {
        return 1;
    }
    if val >= max_val {
        return HIST_DIM;
    }
    let normalized = (val - min_val) / (max_val - min_val);
    let idx = (normalized * (HIST_DIM - 1) as f32).round() as usize + 1;
    idx.clamp(1, HIST_DIM)
}

fn build_raw_histogram_for_palette(
    lab_colors: &[Lab],
    weights: &mut [f64],
    sum_l: &mut [f64],
    sum_a: &mut [f64],
    sum_b: &mut [f64],
    sum_l2_a2_b2: &mut [f64],
) {
    weights.iter_mut().for_each(|x| *x = 0.0);
    sum_l.iter_mut().for_each(|x| *x = 0.0);
    sum_a.iter_mut().for_each(|x| *x = 0.0);
    sum_b.iter_mut().for_each(|x| *x = 0.0);
    sum_l2_a2_b2.iter_mut().for_each(|x| *x = 0.0);

    for lab_color in lab_colors.iter() {
        let l_idx = map_value_to_hist_bin_idx(lab_color.l, L_COMPONENT_MIN, L_COMPONENT_MAX);
        let a_idx = map_value_to_hist_bin_idx(lab_color.a, A_COMPONENT_MIN, A_COMPONENT_MAX);
        let b_idx = map_value_to_hist_bin_idx(lab_color.b, B_COMPONENT_MIN, B_COMPONENT_MAX);
        let flat_idx = get_table_idx(l_idx, a_idx, b_idx);
        weights[flat_idx] += 1.0;
        sum_l[flat_idx] += lab_color.l as f64;
        sum_a[flat_idx] += lab_color.a as f64;
        sum_b[flat_idx] += lab_color.b as f64;
        sum_l2_a2_b2[flat_idx] +=
            (lab_color.l.powi(2) + lab_color.a.powi(2) + lab_color.b.powi(2)) as f64;
    }
}

fn compute_cumulative_moments(
    weights: &mut [f64],
    sum_l: &mut [f64],
    sum_a: &mut [f64],
    sum_b: &mut [f64],
    sum_l2_a2_b2: &mut [f64],
) {
    let mut area_w = vec![0.0; MOMENT_TABLE_DIM];
    let mut area_l = vec![0.0; MOMENT_TABLE_DIM];
    let mut area_a = vec![0.0; MOMENT_TABLE_DIM];
    let mut area_b = vec![0.0; MOMENT_TABLE_DIM];
    let mut area_l2a2b2 = vec![0.0; MOMENT_TABLE_DIM];
    for l_idx in 1..=HIST_DIM {
        area_w.iter_mut().for_each(|x| *x = 0.0);
        area_l.iter_mut().for_each(|x| *x = 0.0);
        area_a.iter_mut().for_each(|x| *x = 0.0);
        area_b.iter_mut().for_each(|x| *x = 0.0);
        area_l2a2b2.iter_mut().for_each(|x| *x = 0.0);
        for a_idx in 1..=HIST_DIM {
            let mut line_w = 0.0;
            let mut line_l = 0.0;
            let mut line_a = 0.0;
            let mut line_b = 0.0;
            let mut line_l2a2b2 = 0.0;
            for b_idx in 1..=HIST_DIM {
                let idx1 = get_table_idx(l_idx, a_idx, b_idx);
                line_w += weights[idx1];
                line_l += sum_l[idx1];
                line_a += sum_a[idx1];
                line_b += sum_b[idx1];
                line_l2a2b2 += sum_l2_a2_b2[idx1];
                area_w[b_idx] += line_w;
                area_l[b_idx] += line_l;
                area_a[b_idx] += line_a;
                area_b[b_idx] += line_b;
                area_l2a2b2[b_idx] += line_l2a2b2;
                let idx_prev_l = get_table_idx(l_idx - 1, a_idx, b_idx);
                weights[idx1] = weights[idx_prev_l] + area_w[b_idx];
                sum_l[idx1] = sum_l[idx_prev_l] + area_l[b_idx];
                sum_a[idx1] = sum_a[idx_prev_l] + area_a[b_idx];
                sum_b[idx1] = sum_b[idx_prev_l] + area_b[b_idx];
                sum_l2_a2_b2[idx1] = sum_l2_a2_b2[idx_prev_l] + area_l2a2b2[b_idx];
            }
        }
    }
}

fn calculate_sum_in_box(cube: &ColorBox, moment_table: &[f64]) -> f64 {
    moment_table[get_table_idx(cube.l1, cube.a1, cube.b1)]
        - moment_table[get_table_idx(cube.l1, cube.a1, cube.b0)]
        - moment_table[get_table_idx(cube.l1, cube.a0, cube.b1)]
        + moment_table[get_table_idx(cube.l1, cube.a0, cube.b0)]
        - moment_table[get_table_idx(cube.l0, cube.a1, cube.b1)]
        + moment_table[get_table_idx(cube.l0, cube.a1, cube.b0)]
        + moment_table[get_table_idx(cube.l0, cube.a0, cube.b1)]
        - moment_table[get_table_idx(cube.l0, cube.a0, cube.b0)]
}

fn bottom_sum(cube: &ColorBox, axis: ColorAxis, moment_table: &[f64]) -> f64 {
    match axis {
        ColorAxis::L => {
            -moment_table[get_table_idx(cube.l0, cube.a1, cube.b1)]
                + moment_table[get_table_idx(cube.l0, cube.a1, cube.b0)]
                + moment_table[get_table_idx(cube.l0, cube.a0, cube.b1)]
                - moment_table[get_table_idx(cube.l0, cube.a0, cube.b0)]
        }
        ColorAxis::A => {
            -moment_table[get_table_idx(cube.l1, cube.a0, cube.b1)]
                + moment_table[get_table_idx(cube.l1, cube.a0, cube.b0)]
                + moment_table[get_table_idx(cube.l0, cube.a0, cube.b1)]
                - moment_table[get_table_idx(cube.l0, cube.a0, cube.b0)]
        }
        ColorAxis::B => {
            -moment_table[get_table_idx(cube.l1, cube.a1, cube.b0)]
                + moment_table[get_table_idx(cube.l1, cube.a0, cube.b0)]
                + moment_table[get_table_idx(cube.l0, cube.a1, cube.b0)]
                - moment_table[get_table_idx(cube.l0, cube.a0, cube.b0)]
        }
    }
}

fn top_sum(cube: &ColorBox, axis: ColorAxis, pos: usize, moment_table: &[f64]) -> f64 {
    match axis {
        ColorAxis::L => {
            moment_table[get_table_idx(pos, cube.a1, cube.b1)]
                - moment_table[get_table_idx(pos, cube.a1, cube.b0)]
                - moment_table[get_table_idx(pos, cube.a0, cube.b1)]
                + moment_table[get_table_idx(pos, cube.a0, cube.b0)]
        }
        ColorAxis::A => {
            moment_table[get_table_idx(cube.l1, pos, cube.b1)]
                - moment_table[get_table_idx(cube.l1, pos, cube.b0)]
                - moment_table[get_table_idx(cube.l0, pos, cube.b1)]
                + moment_table[get_table_idx(cube.l0, pos, cube.b0)]
        }
        ColorAxis::B => {
            moment_table[get_table_idx(cube.l1, cube.a1, pos)]
                - moment_table[get_table_idx(cube.l1, cube.a0, pos)]
                - moment_table[get_table_idx(cube.l0, cube.a1, pos)]
                + moment_table[get_table_idx(cube.l0, cube.a0, pos)]
        }
    }
}

fn calculate_box_variance(
    cube: &ColorBox,
    weights: &[f64],
    sum_l: &[f64],
    sum_a: &[f64],
    sum_b: &[f64],
    sum_l2_a2_b2: &[f64],
) -> f64 {
    let w = calculate_sum_in_box(cube, weights);
    if w == 0.0 {
        return 0.0;
    }
    let sl = calculate_sum_in_box(cube, sum_l);
    let sa = calculate_sum_in_box(cube, sum_a);
    let sb = calculate_sum_in_box(cube, sum_b);
    let s_l2a2b2 = calculate_sum_in_box(cube, sum_l2_a2_b2);
    s_l2a2b2 - (sl * sl + sa * sa + sb * sb) / w
}

#[allow(clippy::too_many_arguments)]
fn find_best_cut_for_axis(
    cube: &ColorBox,
    axis: ColorAxis,
    first_idx: usize,
    last_idx: usize,
    total_w: f64,
    total_l: f64,
    total_a: f64,
    total_b: f64,
    weights: &[f64],
    sum_l: &[f64],
    sum_a: &[f64],
    sum_b: &[f64],
) -> (f64, Option<usize>) {
    let base_w = bottom_sum(cube, axis, weights);
    let base_l = bottom_sum(cube, axis, sum_l);
    let base_a = bottom_sum(cube, axis, sum_a);
    let base_b = bottom_sum(cube, axis, sum_b);
    let mut max_score = 0.0;
    let mut cut_val = None;
    for i in first_idx..last_idx {
        let half_w1 = base_w + top_sum(cube, axis, i, weights);
        if half_w1 == 0.0 {
            continue;
        }
        let half_l1 = base_l + top_sum(cube, axis, i, sum_l);
        let half_a1 = base_a + top_sum(cube, axis, i, sum_a);
        let half_b1 = base_b + top_sum(cube, axis, i, sum_b);
        let score1 = (half_l1.powi(2) + half_a1.powi(2) + half_b1.powi(2)) / half_w1;
        let half_w2 = total_w - half_w1;
        if half_w2 == 0.0 {
            continue;
        }
        let half_l2 = total_l - half_l1;
        let half_a2 = total_a - half_a1;
        let half_b2 = total_b - half_b1;
        let score2 = (half_l2.powi(2) + half_a2.powi(2) + half_b2.powi(2)) / half_w2;
        let current_score = score1 + score2;
        if current_score > max_score {
            max_score = current_score;
            cut_val = Some(i);
        }
    }
    (max_score, cut_val)
}

fn split_box(
    box1_orig: &ColorBox,
    weights: &[f64],
    sum_l: &[f64],
    sum_a: &[f64],
    sum_b: &[f64],
) -> Option<(ColorBox, ColorBox)> {
    let whole_w = calculate_sum_in_box(box1_orig, weights);
    if whole_w == 0.0 {
        return None;
    }
    let whole_l = calculate_sum_in_box(box1_orig, sum_l);
    let whole_a = calculate_sum_in_box(box1_orig, sum_a);
    let whole_b = calculate_sum_in_box(box1_orig, sum_b);

    let (score_l, cut_l) = find_best_cut_for_axis(
        box1_orig,
        ColorAxis::L,
        box1_orig.l0 + 1,
        box1_orig.l1,
        whole_w,
        whole_l,
        whole_a,
        whole_b,
        weights,
        sum_l,
        sum_a,
        sum_b,
    );
    let (score_a, cut_a) = find_best_cut_for_axis(
        box1_orig,
        ColorAxis::A,
        box1_orig.a0 + 1,
        box1_orig.a1,
        whole_w,
        whole_l,
        whole_a,
        whole_b,
        weights,
        sum_l,
        sum_a,
        sum_b,
    );
    let (score_b, cut_b) = find_best_cut_for_axis(
        box1_orig,
        ColorAxis::B,
        box1_orig.b0 + 1,
        box1_orig.b1,
        whole_w,
        whole_l,
        whole_a,
        whole_b,
        weights,
        sum_l,
        sum_a,
        sum_b,
    );

    let mut best_axis = ColorAxis::L;
    let mut best_cut = cut_l;
    let mut max_score = score_l;
    if score_a >= max_score {
        max_score = score_a;
        best_axis = ColorAxis::A;
        best_cut = cut_a;
    }
    if score_b >= max_score {
        // No specific check for equality needed here, last one wins if equal
        best_axis = ColorAxis::B;
        best_cut = cut_b;
    }

    // Ensure there is a valid cut point
    let cut_pos = best_cut?; // If None, propagate None

    let mut box1 = *box1_orig;
    let mut box2 = *box1_orig;
    match best_axis {
        ColorAxis::L => {
            box2.l0 = cut_pos;
            box1.l1 = cut_pos;
        }
        ColorAxis::A => {
            box2.a0 = cut_pos;
            box1.a1 = cut_pos;
        }
        ColorAxis::B => {
            box2.b0 = cut_pos;
            box1.b1 = cut_pos;
        }
    }
    box1.volume_cells = (box1.l1 - box1.l0) * (box1.a1 - box1.a0) * (box1.b1 - box1.b0);
    box2.volume_cells = (box2.l1 - box2.l0) * (box2.a1 - box2.a0) * (box2.b1 - box2.b0);
    Some((box1, box2))
}
