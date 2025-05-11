pub trait FastMath {
    fn sin_fast(self) -> f32;
    fn cos_fast(self) -> f32;
    fn exp_fast(self) -> f32;
    fn atan_fast(self) -> f32;
    fn atan2_fast(self, x: f32) -> f32;
    fn pow7_fast(self) -> f32;
}

impl FastMath for f32 {
    fn sin_fast(self) -> f32 {
        let inv_6 = 0.16666667;
        let x2 = self * self;
        self * (1.0 - (x2 * inv_6))
    }

    fn cos_fast(self) -> f32 {
        let tp = 1.0 / (2.0 * std::f32::consts::PI);
        let quarter = 0.25;
        let sixteen = 16.0;
        let half = 0.5;

        let x = self * tp;
        let x_plus_quarter = x + quarter;
        let floor_val = x_plus_quarter.floor();
        let x = x - (quarter + floor_val);
        let abs_x = x.abs();
        let abs_x_minus_half = abs_x - half;
        let factor = sixteen * abs_x_minus_half;

        x * factor
    }

    fn exp_fast(self) -> f32 {
        const A_VAL: f32 = 12102203.0;
        const B_VAL: i32 = 1065054451;

        let a = A_VAL;
        let b = B_VAL;

        let mul_ax = a * self;

        let converted_int = mul_ax as i32;

        let t_int = converted_int + b;

        f32::from_bits(t_int as u32)
    }

    fn atan_fast(self) -> f32 {
        let pi_4 = std::f32::consts::PI / 4.0;
        let c1 = 0.2447;
        let c2 = 0.0663;
        let one = 1.0;

        let abs_x = self.abs();
        let term1 = pi_4 * self;
        let term2 = abs_x - one;
        let term3 = c1 + c2 * abs_x;
        term1 - self * (term2 * term3)
    }

    fn atan2_fast(self, x: f32) -> f32 {
        let pi = std::f32::consts::PI;
        let pi_2 = std::f32::consts::PI / 2.0;
        let epsilon = 1e-6;
        let zero = 0.0;

        let abs_mask = 0x7FFFFFFF;
        let sign_mask = 0x80000000;

        let y = self;
        let y_bits = y.to_bits();
        let x_bits = x.to_bits();
        let abs_y_bits = y_bits & abs_mask;
        let abs_x_bits = x_bits & abs_mask;
        let abs_y = f32::from_bits(abs_y_bits);
        let abs_x = f32::from_bits(abs_x_bits);

        let x_near_zero = abs_x < epsilon;
        let y_near_zero = abs_y < epsilon;

        let both_near_zero = x_near_zero && y_near_zero;
        let x_zero_mask = x_near_zero && !y_near_zero;

        let swap_mask = abs_y > abs_x;
        let num = if swap_mask { x } else { y };
        let mut den = if swap_mask { y } else { x };

        den = if x_near_zero { den + epsilon } else { den };

        let den_is_zero = den == zero;
        den = if den_is_zero { 1.0 } else { den };

        let atan_input = num / den;
        let mut result = atan_input.atan_fast();

        let atan_input_bits = atan_input.to_bits();
        let pi_2_sign_bits = atan_input_bits & sign_mask;
        let pi_2_adj = f32::from_bits(pi_2.to_bits() | pi_2_sign_bits);
        let swap_result = pi_2_adj - result;
        result = if swap_mask { swap_result } else { result };

        let y_sign_bits = y_bits & sign_mask;
        let y_is_neg = (y_sign_bits) != 0;
        let x_zero_result = if y_is_neg { -pi_2 } else { pi_2 };
        result = if x_zero_mask { x_zero_result } else { result };

        let x_neg_mask = x < zero;
        let pi_adj = f32::from_bits(pi.to_bits() ^ y_sign_bits);
        let quad_adj = if x_neg_mask { pi_adj } else { zero };
        result += quad_adj;

        result = if both_near_zero { zero } else { result };

        result
    }

    fn pow7_fast(self) -> f32 {
        let x2 = self * self;
        let x32 = x2 * x2;
        self * x2 * x32 // x^1 * x^2 * x^4 = x^7
    }
}
