struct Lab {
    l: f32,
    a: f32,
    b: f32,
    padding: f32,
};

struct Config {
    transparency_threshold: u32,
    diff_formula: u32,
    smooth_formula: u32,
    palette_size: u32,
    palette: array<vec4<u32>, 64>,
    smooth_strength: f32,
    dither_algorithm: u32,
    dither_strength: f32,
    image_width: u32,
    image_height: u32,
};

struct FragmentInput {
    @location(0) tex_coord: vec2<f32>,
};

@group(0) @binding(0) var t_input: texture_2d<f32>;
@group(0) @binding(1) var s_input: sampler;
@group(0) @binding(2) var<uniform> config: Config;

const NOISE_DIM: u32 = 64u;

const BLUE_NOISE_64X64: array<u32, 4096> = array<u32, 4096>(
    65u, 247u, 203u, 177u, 54u, 149u, 96u, 135u, 122u, 62u, 109u, 206u, 27u, 217u, 152u, 103u, 250u, 78u, 122u, 228u,
    3u, 83u, 233u, 160u, 45u, 242u, 108u, 40u, 125u, 93u, 201u, 35u, 231u, 187u, 254u, 207u, 147u, 13u, 87u, 134u, 246u,
    197u, 177u, 224u, 59u, 92u, 132u, 169u, 49u, 183u, 140u, 3u, 58u, 165u, 27u, 204u, 12u, 83u, 196u, 4u, 159u, 183u,
    92u, 197u, 170u, 140u, 24u, 127u, 109u, 255u, 35u, 210u, 79u, 193u, 178u, 141u, 168u, 11u, 69u, 130u, 182u, 27u,
    147u, 47u, 191u, 170u, 66u, 13u, 187u, 76u, 0u, 197u, 161u, 66u, 146u, 172u, 104u, 134u, 58u, 97u, 182u, 232u, 162u,
    115u, 34u, 73u, 2u, 238u, 162u, 188u, 6u, 243u, 218u, 31u, 69u, 193u, 244u, 87u, 146u, 130u, 248u, 172u, 225u, 104u,
    235u, 21u, 218u, 117u, 236u, 49u, 87u, 155u, 228u, 69u, 15u, 166u, 235u, 24u, 48u, 86u, 119u, 238u, 195u, 90u, 6u,
    221u, 165u, 105u, 20u, 255u, 120u, 146u, 211u, 129u, 88u, 236u, 21u, 52u, 245u, 17u, 73u, 158u, 24u, 7u, 126u, 43u,
    64u, 190u, 218u, 95u, 128u, 23u, 207u, 46u, 113u, 145u, 85u, 102u, 229u, 119u, 40u, 106u, 222u, 66u, 49u, 152u, 31u,
    126u, 46u, 145u, 57u, 10u, 191u, 104u, 213u, 3u, 42u, 197u, 182u, 104u, 147u, 1u, 223u, 252u, 60u, 34u, 161u, 45u,
    244u, 61u, 208u, 133u, 89u, 199u, 37u, 56u, 245u, 29u, 174u, 152u, 114u, 190u, 212u, 127u, 179u, 238u, 216u, 195u,
    246u, 109u, 26u, 240u, 170u, 51u, 155u, 108u, 81u, 249u, 28u, 195u, 60u, 175u, 153u, 19u, 208u, 177u, 15u, 187u,
    114u, 211u, 93u, 72u, 178u, 203u, 82u, 162u, 28u, 72u, 179u, 242u, 160u, 83u, 120u, 55u, 214u, 128u, 156u, 100u,
    180u, 136u, 214u, 106u, 144u, 117u, 30u, 231u, 71u, 155u, 177u, 106u, 94u, 224u, 47u, 69u, 229u, 99u, 83u, 4u, 45u,
    114u, 87u, 141u, 72u, 156u, 203u, 79u, 139u, 13u, 232u, 181u, 137u, 67u, 159u, 212u, 10u, 130u, 254u, 77u, 52u,
    160u, 235u, 80u, 5u, 241u, 192u, 18u, 254u, 111u, 227u, 131u, 248u, 147u, 115u, 59u, 133u, 207u, 26u, 248u, 91u,
    67u, 31u, 202u, 13u, 78u, 229u, 16u, 201u, 82u, 183u, 52u, 240u, 18u, 221u, 7u, 139u, 163u, 202u, 12u, 134u, 32u,
    164u, 224u, 198u, 63u, 33u, 170u, 51u, 224u, 101u, 19u, 116u, 211u, 61u, 198u, 36u, 226u, 121u, 93u, 236u, 38u,
    200u, 97u, 141u, 123u, 33u, 102u, 139u, 165u, 58u, 133u, 157u, 4u, 96u, 41u, 199u, 13u, 219u, 98u, 16u, 227u, 144u,
    39u, 189u, 172u, 237u, 113u, 53u, 189u, 126u, 67u, 173u, 156u, 4u, 101u, 141u, 114u, 205u, 63u, 191u, 79u, 118u,
    241u, 185u, 57u, 143u, 248u, 102u, 154u, 229u, 121u, 0u, 178u, 38u, 150u, 186u, 254u, 89u, 4u, 101u, 173u, 17u,
    186u, 54u, 112u, 167u, 0u, 215u, 247u, 63u, 203u, 227u, 42u, 85u, 220u, 34u, 207u, 64u, 173u, 80u, 51u, 186u, 37u,
    171u, 73u, 110u, 161u, 9u, 220u, 81u, 140u, 164u, 241u, 25u, 95u, 253u, 38u, 215u, 194u, 170u, 43u, 85u, 125u, 250u,
    21u, 40u, 149u, 108u, 208u, 76u, 21u, 130u, 12u, 183u, 252u, 94u, 210u, 241u, 129u, 68u, 44u, 165u, 127u, 242u, 47u,
    152u, 82u, 142u, 223u, 71u, 28u, 179u, 86u, 189u, 150u, 24u, 176u, 122u, 104u, 184u, 141u, 239u, 120u, 225u, 135u,
    89u, 253u, 125u, 193u, 243u, 60u, 97u, 123u, 44u, 5u, 212u, 104u, 148u, 50u, 223u, 135u, 120u, 74u, 248u, 29u, 229u,
    158u, 53u, 177u, 214u, 88u, 5u, 168u, 42u, 192u, 90u, 213u, 74u, 28u, 135u, 59u, 83u, 9u, 225u, 110u, 27u, 145u,
    215u, 70u, 205u, 251u, 22u, 194u, 155u, 243u, 133u, 46u, 8u, 115u, 73u, 249u, 14u, 233u, 77u, 47u, 23u, 154u, 106u,
    165u, 205u, 2u, 152u, 49u, 24u, 206u, 232u, 150u, 183u, 251u, 66u, 34u, 203u, 185u, 20u, 86u, 57u, 10u, 150u, 96u,
    186u, 3u, 137u, 234u, 102u, 63u, 254u, 221u, 119u, 232u, 174u, 53u, 148u, 202u, 162u, 115u, 195u, 173u, 154u, 203u,
    235u, 79u, 189u, 114u, 6u, 131u, 105u, 43u, 91u, 118u, 59u, 226u, 162u, 95u, 213u, 136u, 55u, 194u, 163u, 94u, 212u,
    10u, 240u, 28u, 64u, 232u, 104u, 84u, 178u, 137u, 74u, 17u, 198u, 89u, 131u, 171u, 77u, 113u, 160u, 236u, 199u,
    225u, 128u, 65u, 209u, 108u, 75u, 34u, 155u, 196u, 132u, 29u, 157u, 67u, 112u, 36u, 240u, 105u, 19u, 46u, 220u, 32u,
    93u, 53u, 10u, 178u, 58u, 33u, 226u, 169u, 63u, 182u, 235u, 206u, 18u, 107u, 198u, 236u, 39u, 157u, 205u, 1u, 127u,
    252u, 177u, 72u, 191u, 122u, 42u, 143u, 199u, 12u, 218u, 119u, 35u, 108u, 54u, 159u, 23u, 240u, 219u, 0u, 143u,
    100u, 177u, 36u, 166u, 243u, 15u, 173u, 224u, 123u, 19u, 183u, 49u, 82u, 15u, 244u, 141u, 3u, 217u, 81u, 185u, 250u,
    142u, 73u, 106u, 246u, 124u, 137u, 99u, 156u, 240u, 86u, 202u, 10u, 135u, 35u, 170u, 143u, 69u, 182u, 27u, 87u,
    109u, 66u, 147u, 30u, 115u, 53u, 150u, 174u, 221u, 76u, 164u, 241u, 57u, 156u, 248u, 173u, 226u, 214u, 99u, 120u,
    60u, 43u, 247u, 67u, 16u, 110u, 51u, 144u, 89u, 200u, 56u, 246u, 94u, 208u, 146u, 105u, 179u, 205u, 94u, 190u, 128u,
    65u, 170u, 7u, 122u, 229u, 22u, 193u, 162u, 218u, 15u, 196u, 46u, 123u, 29u, 159u, 73u, 217u, 84u, 255u, 13u, 53u,
    130u, 244u, 174u, 230u, 43u, 220u, 202u, 86u, 245u, 22u, 93u, 131u, 33u, 114u, 95u, 190u, 2u, 84u, 140u, 40u, 9u,
    146u, 179u, 194u, 130u, 210u, 80u, 191u, 219u, 25u, 119u, 41u, 139u, 163u, 11u, 70u, 239u, 219u, 124u, 57u, 162u,
    44u, 228u, 152u, 97u, 56u, 209u, 156u, 180u, 66u, 42u, 85u, 253u, 71u, 143u, 103u, 224u, 248u, 113u, 178u, 44u,
    124u, 224u, 104u, 150u, 216u, 23u, 81u, 185u, 101u, 137u, 6u, 111u, 210u, 52u, 229u, 180u, 17u, 213u, 45u, 131u,
    236u, 63u, 188u, 206u, 81u, 232u, 93u, 28u, 163u, 121u, 253u, 152u, 70u, 237u, 187u, 80u, 215u, 116u, 43u, 169u, 6u,
    34u, 77u, 253u, 12u, 113u, 29u, 239u, 199u, 38u, 83u, 131u, 3u, 232u, 112u, 27u, 167u, 214u, 1u, 188u, 53u, 96u,
    148u, 4u, 196u, 161u, 75u, 189u, 7u, 119u, 58u, 159u, 17u, 234u, 67u, 185u, 158u, 11u, 193u, 65u, 247u, 144u, 72u,
    204u, 26u, 122u, 105u, 255u, 158u, 52u, 12u, 223u, 141u, 40u, 6u, 92u, 207u, 172u, 1u, 31u, 102u, 252u, 142u, 191u,
    91u, 234u, 197u, 135u, 182u, 87u, 211u, 138u, 16u, 116u, 248u, 98u, 212u, 146u, 201u, 182u, 59u, 131u, 82u, 153u,
    17u, 207u, 241u, 63u, 91u, 238u, 32u, 205u, 96u, 144u, 250u, 198u, 126u, 169u, 39u, 254u, 98u, 139u, 121u, 86u,
    170u, 107u, 160u, 92u, 183u, 168u, 15u, 70u, 33u, 117u, 174u, 106u, 62u, 233u, 183u, 55u, 132u, 107u, 158u, 230u,
    198u, 59u, 23u, 128u, 64u, 111u, 151u, 21u, 222u, 53u, 166u, 74u, 177u, 191u, 62u, 30u, 172u, 52u, 121u, 92u, 238u,
    38u, 246u, 171u, 69u, 34u, 128u, 184u, 23u, 117u, 49u, 168u, 67u, 222u, 34u, 88u, 51u, 214u, 78u, 29u, 57u, 206u,
    233u, 40u, 21u, 221u, 7u, 250u, 54u, 228u, 152u, 198u, 133u, 215u, 245u, 75u, 204u, 169u, 101u, 22u, 244u, 44u, 66u,
    124u, 88u, 180u, 226u, 157u, 212u, 175u, 47u, 102u, 68u, 127u, 246u, 106u, 46u, 226u, 158u, 136u, 242u, 77u, 9u,
    155u, 19u, 105u, 198u, 118u, 225u, 142u, 105u, 229u, 153u, 215u, 138u, 246u, 17u, 130u, 176u, 229u, 3u, 116u, 148u,
    129u, 173u, 6u, 75u, 153u, 199u, 59u, 117u, 34u, 138u, 80u, 43u, 242u, 87u, 20u, 186u, 149u, 9u, 128u, 81u, 220u,
    194u, 140u, 213u, 16u, 148u, 49u, 8u, 81u, 32u, 249u, 0u, 231u, 205u, 155u, 27u, 4u, 147u, 88u, 12u, 109u, 219u, 41u,
    186u, 228u, 208u, 138u, 49u, 21u, 190u, 85u, 167u, 14u, 56u, 80u, 101u, 187u, 42u, 111u, 74u, 156u, 103u, 240u,
    195u, 90u, 225u, 111u, 244u, 178u, 127u, 238u, 190u, 210u, 100u, 218u, 2u, 112u, 165u, 56u, 98u, 35u, 48u, 249u,
    156u, 114u, 34u, 177u, 78u, 250u, 166u, 110u, 241u, 99u, 199u, 123u, 143u, 88u, 172u, 39u, 194u, 217u, 125u, 255u,
    204u, 24u, 194u, 96u, 128u, 61u, 164u, 77u, 234u, 97u, 59u, 212u, 42u, 243u, 201u, 175u, 0u, 230u, 150u, 210u, 192u,
    25u, 61u, 180u, 16u, 69u, 35u, 144u, 50u, 99u, 28u, 88u, 70u, 151u, 173u, 125u, 65u, 181u, 140u, 200u, 232u, 119u,
    214u, 191u, 18u, 68u, 236u, 7u, 97u, 200u, 39u, 219u, 184u, 138u, 55u, 72u, 187u, 16u, 115u, 79u, 236u, 99u, 66u,
    181u, 79u, 57u, 166u, 148u, 251u, 31u, 114u, 7u, 176u, 149u, 253u, 9u, 133u, 71u, 114u, 31u, 126u, 64u, 88u, 12u,
    247u, 142u, 220u, 45u, 208u, 249u, 158u, 189u, 216u, 15u, 137u, 164u, 47u, 10u, 22u, 193u, 235u, 31u, 222u, 14u,
    70u, 163u, 142u, 60u, 91u, 168u, 146u, 121u, 57u, 133u, 19u, 65u, 119u, 13u, 230u, 161u, 213u, 241u, 58u, 137u,
    177u, 51u, 160u, 33u, 134u, 240u, 118u, 1u, 71u, 216u, 90u, 189u, 221u, 32u, 121u, 162u, 184u, 94u, 226u, 157u,
    252u, 204u, 166u, 53u, 98u, 122u, 82u, 164u, 134u, 118u, 0u, 82u, 63u, 202u, 253u, 185u, 228u, 109u, 246u, 91u,
    146u, 48u, 103u, 128u, 84u, 242u, 1u, 108u, 227u, 201u, 45u, 216u, 187u, 238u, 154u, 90u, 207u, 174u, 44u, 25u, 95u,
    36u, 153u, 223u, 6u, 119u, 210u, 16u, 222u, 92u, 175u, 50u, 197u, 139u, 243u, 45u, 131u, 70u, 106u, 204u, 22u, 144u,
    195u, 47u, 106u, 22u, 137u, 217u, 35u, 173u, 231u, 28u, 95u, 236u, 175u, 224u, 125u, 103u, 39u, 76u, 215u, 132u,
    57u, 201u, 77u, 159u, 253u, 209u, 28u, 175u, 188u, 37u, 132u, 254u, 26u, 85u, 107u, 164u, 30u, 247u, 76u, 147u,
    107u, 252u, 132u, 202u, 109u, 22u, 249u, 88u, 193u, 149u, 107u, 40u, 231u, 211u, 23u, 105u, 154u, 18u, 166u, 237u,
    51u, 82u, 246u, 61u, 6u, 86u, 179u, 77u, 240u, 112u, 185u, 68u, 10u, 193u, 55u, 108u, 43u, 23u, 167u, 148u, 8u, 118u,
    154u, 27u, 168u, 38u, 121u, 178u, 6u, 62u, 154u, 95u, 223u, 54u, 76u, 153u, 176u, 4u, 70u, 222u, 51u, 128u, 190u, 2u,
    218u, 81u, 169u, 65u, 184u, 75u, 166u, 45u, 233u, 71u, 186u, 11u, 158u, 76u, 124u, 181u, 62u, 84u, 193u, 2u, 215u,
    175u, 36u, 219u, 130u, 237u, 149u, 40u, 192u, 3u, 131u, 249u, 153u, 205u, 143u, 213u, 73u, 198u, 243u, 85u, 230u,
    179u, 65u, 96u, 209u, 240u, 19u, 219u, 111u, 195u, 43u, 135u, 117u, 208u, 12u, 101u, 124u, 233u, 141u, 201u, 15u,
    101u, 231u, 60u, 117u, 195u, 48u, 12u, 125u, 206u, 101u, 139u, 25u, 127u, 245u, 54u, 141u, 98u, 247u, 35u, 227u,
    208u, 96u, 118u, 137u, 153u, 100u, 114u, 165u, 207u, 15u, 223u, 60u, 161u, 90u, 47u, 104u, 79u, 18u, 255u, 156u,
    135u, 57u, 31u, 204u, 48u, 248u, 1u, 187u, 136u, 69u, 90u, 143u, 233u, 79u, 248u, 21u, 164u, 243u, 184u, 59u, 194u,
    34u, 114u, 172u, 151u, 40u, 180u, 23u, 156u, 235u, 224u, 146u, 244u, 35u, 220u, 62u, 174u, 86u, 115u, 206u, 191u,
    5u, 169u, 52u, 142u, 251u, 29u, 64u, 233u, 9u, 190u, 49u, 69u, 122u, 102u, 142u, 200u, 235u, 29u, 225u, 126u, 180u,
    93u, 4u, 120u, 97u, 187u, 111u, 137u, 162u, 78u, 104u, 226u, 46u, 165u, 30u, 183u, 10u, 203u, 66u, 145u, 83u, 217u,
    44u, 159u, 93u, 252u, 65u, 208u, 85u, 243u, 140u, 99u, 30u, 89u, 57u, 1u, 160u, 113u, 199u, 7u, 214u, 163u, 20u, 66u,
    221u, 129u, 112u, 11u, 160u, 180u, 44u, 198u, 76u, 255u, 92u, 27u, 175u, 245u, 83u, 19u, 116u, 168u, 188u, 61u, 36u,
    165u, 50u, 223u, 173u, 12u, 218u, 21u, 233u, 125u, 151u, 14u, 199u, 251u, 57u, 102u, 125u, 171u, 48u, 110u, 31u,
    134u, 16u, 238u, 78u, 8u, 132u, 226u, 19u, 124u, 72u, 205u, 171u, 115u, 191u, 80u, 180u, 93u, 251u, 151u, 37u, 236u,
    46u, 94u, 148u, 79u, 237u, 201u, 71u, 90u, 221u, 126u, 18u, 157u, 136u, 231u, 187u, 37u, 210u, 54u, 71u, 216u, 9u,
    147u, 231u, 69u, 193u, 240u, 76u, 147u, 60u, 90u, 193u, 37u, 55u, 177u, 114u, 131u, 214u, 157u, 224u, 92u, 239u,
    196u, 229u, 98u, 206u, 119u, 177u, 215u, 49u, 96u, 166u, 197u, 5u, 255u, 44u, 135u, 239u, 216u, 23u, 131u, 50u,
    103u, 77u, 123u, 178u, 254u, 26u, 187u, 39u, 103u, 20u, 242u, 147u, 105u, 171u, 209u, 58u, 111u, 11u, 162u, 124u,
    150u, 252u, 134u, 99u, 206u, 112u, 141u, 17u, 33u, 207u, 127u, 252u, 169u, 72u, 212u, 245u, 92u, 26u, 82u, 3u, 71u,
    39u, 18u, 150u, 181u, 1u, 167u, 69u, 143u, 24u, 155u, 188u, 35u, 146u, 55u, 109u, 220u, 65u, 19u, 152u, 39u, 70u,
    233u, 189u, 15u, 227u, 136u, 196u, 109u, 161u, 215u, 59u, 170u, 132u, 189u, 54u, 33u, 82u, 227u, 40u, 145u, 74u,
    195u, 93u, 0u, 178u, 42u, 83u, 25u, 246u, 125u, 89u, 107u, 157u, 45u, 100u, 29u, 121u, 5u, 158u, 203u, 235u, 145u,
    188u, 244u, 208u, 116u, 78u, 61u, 129u, 46u, 249u, 192u, 57u, 105u, 246u, 116u, 235u, 178u, 82u, 158u, 185u, 98u,
    202u, 122u, 173u, 145u, 61u, 166u, 205u, 28u, 55u, 0u, 85u, 121u, 140u, 231u, 210u, 3u, 118u, 249u, 200u, 8u, 98u,
    246u, 215u, 50u, 234u, 220u, 107u, 199u, 158u, 56u, 175u, 41u, 212u, 235u, 177u, 7u, 200u, 227u, 185u, 106u, 134u,
    65u, 44u, 167u, 108u, 54u, 175u, 140u, 255u, 23u, 220u, 90u, 113u, 36u, 231u, 83u, 2u, 70u, 200u, 15u, 31u, 126u,
    230u, 9u, 84u, 250u, 107u, 10u, 213u, 115u, 90u, 156u, 72u, 223u, 242u, 14u, 32u, 75u, 45u, 87u, 158u, 176u, 68u,
    133u, 190u, 168u, 116u, 20u, 132u, 33u, 64u, 241u, 13u, 226u, 188u, 2u, 148u, 61u, 82u, 136u, 239u, 53u, 149u, 82u,
    220u, 17u, 99u, 226u, 31u, 126u, 8u, 193u, 100u, 160u, 204u, 185u, 16u, 148u, 209u, 127u, 172u, 219u, 136u, 93u,
    242u, 143u, 52u, 214u, 164u, 47u, 197u, 32u, 78u, 247u, 41u, 235u, 144u, 102u, 173u, 205u, 183u, 152u, 99u, 238u,
    216u, 17u, 108u, 151u, 28u, 86u, 61u, 181u, 154u, 78u, 171u, 143u, 116u, 95u, 75u, 167u, 221u, 192u, 20u, 115u, 68u,
    165u, 13u, 40u, 253u, 176u, 196u, 76u, 154u, 237u, 87u, 44u, 230u, 30u, 136u, 76u, 239u, 164u, 95u, 47u, 22u, 157u,
    61u, 43u, 206u, 181u, 71u, 118u, 25u, 140u, 94u, 224u, 179u, 132u, 7u, 184u, 200u, 126u, 48u, 64u, 249u, 112u, 195u,
    26u, 127u, 56u, 234u, 42u, 219u, 239u, 5u, 207u, 250u, 91u, 189u, 27u, 211u, 134u, 253u, 103u, 121u, 48u, 248u,
    182u, 95u, 217u, 129u, 192u, 58u, 117u, 138u, 22u, 202u, 60u, 169u, 216u, 68u, 109u, 52u, 122u, 5u, 64u, 195u, 227u,
    183u, 102u, 250u, 113u, 167u, 6u, 103u, 244u, 192u, 64u, 237u, 150u, 54u, 162u, 97u, 67u, 20u, 34u, 163u, 90u, 134u,
    6u, 168u, 69u, 142u, 182u, 201u, 78u, 124u, 162u, 142u, 104u, 39u, 123u, 12u, 233u, 49u, 66u, 32u, 144u, 14u, 90u,
    160u, 36u, 205u, 24u, 109u, 232u, 92u, 159u, 0u, 245u, 111u, 94u, 130u, 16u, 183u, 153u, 247u, 176u, 222u, 141u,
    31u, 74u, 133u, 10u, 212u, 28u, 147u, 81u, 222u, 38u, 174u, 124u, 2u, 111u, 21u, 209u, 121u, 221u, 253u, 110u, 214u,
    17u, 229u, 53u, 220u, 37u, 254u, 93u, 1u, 171u, 100u, 50u, 71u, 192u, 223u, 56u, 202u, 109u, 162u, 182u, 198u, 238u,
    209u, 227u, 64u, 140u, 243u, 153u, 74u, 172u, 33u, 212u, 49u, 179u, 219u, 38u, 250u, 144u, 205u, 9u, 84u, 211u, 44u,
    106u, 254u, 118u, 233u, 86u, 191u, 67u, 236u, 197u, 133u, 15u, 156u, 86u, 217u, 74u, 245u, 194u, 44u, 84u, 171u,
    143u, 188u, 77u, 150u, 117u, 203u, 81u, 159u, 120u, 30u, 212u, 247u, 14u, 232u, 26u, 134u, 168u, 148u, 74u, 245u,
    8u, 83u, 53u, 26u, 170u, 126u, 3u, 84u, 50u, 201u, 9u, 241u, 132u, 85u, 69u, 149u, 25u, 191u, 77u, 117u, 35u, 163u,
    96u, 20u, 150u, 181u, 56u, 167u, 40u, 155u, 122u, 48u, 95u, 58u, 254u, 203u, 46u, 185u, 167u, 35u, 137u, 154u, 10u,
    56u, 235u, 99u, 40u, 246u, 178u, 102u, 13u, 189u, 228u, 60u, 135u, 186u, 154u, 113u, 177u, 83u, 6u, 228u, 41u, 93u,
    154u, 130u, 180u, 73u, 98u, 196u, 111u, 230u, 184u, 123u, 62u, 146u, 106u, 188u, 231u, 123u, 165u, 54u, 103u, 223u,
    63u, 242u, 129u, 198u, 79u, 8u, 203u, 25u, 138u, 221u, 0u, 181u, 164u, 24u, 114u, 100u, 144u, 234u, 61u, 106u, 91u,
    226u, 181u, 72u, 131u, 1u, 210u, 60u, 22u, 138u, 240u, 47u, 107u, 148u, 75u, 38u, 89u, 209u, 62u, 255u, 99u, 120u,
    214u, 20u, 206u, 114u, 37u, 223u, 147u, 254u, 43u, 19u, 166u, 97u, 222u, 20u, 207u, 41u, 10u, 97u, 211u, 14u, 236u,
    172u, 140u, 189u, 52u, 230u, 160u, 217u, 92u, 110u, 239u, 73u, 103u, 247u, 214u, 141u, 229u, 72u, 8u, 28u, 130u,
    207u, 13u, 250u, 112u, 198u, 30u, 162u, 121u, 194u, 91u, 156u, 68u, 215u, 9u, 200u, 237u, 19u, 225u, 127u, 46u,
    198u, 32u, 186u, 136u, 173u, 63u, 248u, 160u, 190u, 11u, 58u, 135u, 217u, 151u, 33u, 248u, 79u, 174u, 157u, 254u,
    65u, 196u, 130u, 42u, 87u, 26u, 1u, 109u, 69u, 30u, 123u, 246u, 60u, 172u, 197u, 131u, 20u, 64u, 35u, 188u, 170u,
    216u, 155u, 241u, 79u, 172u, 26u, 50u, 150u, 222u, 242u, 80u, 171u, 226u, 34u, 129u, 164u, 88u, 175u, 123u, 101u,
    168u, 2u, 142u, 161u, 239u, 70u, 50u, 234u, 104u, 0u, 92u, 120u, 79u, 174u, 199u, 89u, 70u, 118u, 191u, 136u, 55u,
    115u, 30u, 141u, 81u, 245u, 155u, 184u, 120u, 210u, 252u, 177u, 143u, 46u, 185u, 149u, 16u, 38u, 89u, 159u, 205u,
    82u, 125u, 44u, 89u, 117u, 54u, 193u, 146u, 124u, 212u, 87u, 103u, 44u, 141u, 17u, 51u, 252u, 112u, 187u, 27u, 248u,
    42u, 67u, 195u, 243u, 80u, 108u, 14u, 151u, 87u, 29u, 196u, 140u, 46u, 211u, 232u, 25u, 106u, 245u, 13u, 49u, 232u,
    5u, 94u, 201u, 222u, 181u, 4u, 107u, 217u, 72u, 233u, 149u, 39u, 85u, 101u, 227u, 4u, 81u, 211u, 229u, 53u, 179u,
    112u, 237u, 18u, 197u, 250u, 179u, 3u, 98u, 39u, 237u, 63u, 168u, 6u, 185u, 68u, 209u, 100u, 200u, 2u, 78u, 222u,
    55u, 139u, 155u, 217u, 31u, 58u, 176u, 205u, 218u, 126u, 165u, 225u, 68u, 18u, 243u, 155u, 128u, 37u, 209u, 183u,
    154u, 212u, 169u, 73u, 238u, 45u, 122u, 163u, 55u, 34u, 17u, 97u, 59u, 165u, 192u, 22u, 204u, 134u, 164u, 106u,
    121u, 143u, 244u, 4u, 153u, 98u, 139u, 66u, 32u, 224u, 204u, 73u, 187u, 138u, 23u, 249u, 110u, 228u, 130u, 152u,
    174u, 63u, 144u, 119u, 204u, 8u, 111u, 183u, 92u, 121u, 230u, 23u, 98u, 6u, 252u, 111u, 182u, 145u, 99u, 52u, 72u,
    168u, 139u, 60u, 101u, 128u, 28u, 110u, 149u, 20u, 89u, 230u, 193u, 145u, 175u, 203u, 129u, 11u, 218u, 116u, 237u,
    54u, 68u, 255u, 28u, 190u, 74u, 40u, 217u, 56u, 228u, 163u, 113u, 133u, 159u, 107u, 11u, 219u, 120u, 201u, 156u,
    36u, 12u, 87u, 231u, 43u, 243u, 160u, 89u, 234u, 74u, 24u, 251u, 149u, 41u, 136u, 192u, 78u, 56u, 38u, 204u, 171u,
    6u, 194u, 223u, 113u, 2u, 227u, 80u, 41u, 251u, 186u, 59u, 172u, 210u, 68u, 132u, 247u, 80u, 110u, 239u, 47u, 75u,
    157u, 91u, 36u, 199u, 176u, 11u, 222u, 94u, 169u, 129u, 184u, 11u, 78u, 240u, 19u, 55u, 254u, 174u, 91u, 50u, 76u,
    178u, 58u, 244u, 122u, 24u, 192u, 102u, 35u, 18u, 189u, 171u, 132u, 51u, 201u, 167u, 64u, 243u, 180u, 157u, 130u,
    82u, 28u, 117u, 252u, 88u, 178u, 23u, 242u, 161u, 200u, 11u, 220u, 135u, 242u, 7u, 103u, 42u, 26u, 220u, 3u, 183u,
    138u, 249u, 174u, 14u, 127u, 149u, 100u, 47u, 137u, 62u, 208u, 24u, 105u, 201u, 45u, 176u, 212u, 85u, 36u, 148u,
    230u, 26u, 132u, 96u, 217u, 187u, 71u, 211u, 135u, 168u, 218u, 125u, 64u, 210u, 98u, 14u, 225u, 84u, 105u, 33u,
    119u, 11u, 239u, 216u, 232u, 134u, 59u, 34u, 144u, 206u, 95u, 120u, 67u, 145u, 83u, 99u, 34u, 156u, 202u, 117u,
    167u, 62u, 155u, 93u, 30u, 64u, 107u, 213u, 186u, 241u, 81u, 231u, 160u, 119u, 251u, 85u, 233u, 145u, 124u, 96u,
    152u, 195u, 116u, 66u, 207u, 161u, 238u, 2u, 142u, 164u, 46u, 110u, 8u, 78u, 52u, 250u, 146u, 39u, 240u, 160u, 116u,
    4u, 210u, 229u, 140u, 196u, 94u, 66u, 43u, 184u, 162u, 215u, 77u, 50u, 190u, 32u, 234u, 180u, 48u, 125u, 189u, 77u,
    255u, 141u, 88u, 236u, 210u, 122u, 199u, 150u, 225u, 24u, 56u, 1u, 206u, 111u, 26u, 196u, 5u, 152u, 37u, 68u, 220u,
    0u, 29u, 243u, 138u, 8u, 186u, 41u, 107u, 197u, 30u, 88u, 255u, 151u, 180u, 230u, 94u, 197u, 5u, 108u, 76u, 185u,
    58u, 145u, 172u, 72u, 22u, 51u, 165u, 107u, 147u, 200u, 8u, 100u, 245u, 127u, 154u, 9u, 109u, 166u, 22u, 217u, 232u,
    14u, 55u, 181u, 19u, 190u, 51u, 13u, 231u, 42u, 83u, 120u, 142u, 70u, 169u, 38u, 182u, 77u, 54u, 177u, 114u, 192u,
    249u, 59u, 183u, 75u, 225u, 100u, 126u, 83u, 248u, 55u, 118u, 225u, 18u, 62u, 202u, 31u, 118u, 157u, 176u, 221u,
    139u, 29u, 195u, 253u, 43u, 91u, 184u, 247u, 207u, 14u, 125u, 71u, 237u, 115u, 21u, 174u, 60u, 221u, 253u, 88u,
    199u, 66u, 112u, 173u, 128u, 224u, 36u, 110u, 78u, 134u, 176u, 102u, 190u, 163u, 252u, 95u, 219u, 127u, 245u, 139u,
    215u, 237u, 91u, 16u, 166u, 132u, 108u, 157u, 50u, 16u, 216u, 169u, 151u, 73u, 176u, 207u, 129u, 101u, 240u, 137u,
    68u, 21u, 84u, 48u, 236u, 94u, 123u, 17u, 216u, 132u, 153u, 114u, 81u, 224u, 27u, 92u, 151u, 45u, 225u, 194u, 138u,
    75u, 39u, 129u, 157u, 4u, 144u, 43u, 95u, 72u, 239u, 146u, 165u, 251u, 62u, 5u, 237u, 32u, 202u, 48u, 153u, 9u, 62u,
    99u, 13u, 161u, 128u, 48u, 80u, 213u, 36u, 232u, 176u, 200u, 63u, 25u, 228u, 7u, 137u, 36u, 81u, 169u, 0u, 45u, 185u,
    247u, 211u, 129u, 10u, 203u, 68u, 166u, 104u, 231u, 1u, 62u, 37u, 179u, 255u, 56u, 209u, 168u, 86u, 3u, 101u, 211u,
    182u, 54u, 235u, 102u, 245u, 214u, 195u, 158u, 0u, 202u, 96u, 27u, 213u, 154u, 74u, 133u, 16u, 108u, 188u, 87u,
    227u, 198u, 110u, 32u, 203u, 228u, 148u, 190u, 7u, 92u, 115u, 253u, 145u, 97u, 193u, 109u, 184u, 246u, 51u, 218u,
    192u, 148u, 228u, 104u, 164u, 61u, 151u, 175u, 245u, 50u, 79u, 31u, 189u, 239u, 139u, 161u, 7u, 192u, 130u, 33u,
    67u, 249u, 122u, 15u, 148u, 25u, 206u, 79u, 32u, 169u, 20u, 120u, 63u, 219u, 45u, 126u, 194u, 113u, 90u, 222u, 178u,
    67u, 234u, 27u, 173u, 149u, 51u, 254u, 71u, 20u, 102u, 244u, 65u, 139u, 26u, 80u, 37u, 131u, 47u, 238u, 14u, 93u,
    159u, 112u, 74u, 123u, 89u, 33u, 15u, 115u, 227u, 37u, 110u, 143u, 208u, 158u, 121u, 87u, 214u, 104u, 228u, 112u,
    176u, 234u, 142u, 162u, 198u, 230u, 91u, 172u, 117u, 188u, 133u, 50u, 87u, 249u, 139u, 174u, 84u, 241u, 11u, 52u,
    170u, 38u, 246u, 143u, 117u, 206u, 41u, 123u, 84u, 167u, 138u, 182u, 120u, 42u, 170u, 197u, 156u, 236u, 209u, 163u,
    70u, 213u, 146u, 60u, 230u, 25u, 11u, 210u, 56u, 179u, 206u, 75u, 191u, 88u, 5u, 182u, 224u, 57u, 11u, 199u, 45u,
    73u, 149u, 82u, 18u, 97u, 49u, 27u, 111u, 58u, 41u, 247u, 69u, 10u, 220u, 151u, 107u, 200u, 12u, 35u, 106u, 181u,
    226u, 147u, 207u, 124u, 2u, 54u, 161u, 76u, 13u, 237u, 189u, 222u, 2u, 58u, 208u, 86u, 224u, 126u, 52u, 1u, 181u,
    117u, 21u, 85u, 172u, 124u, 201u, 136u, 253u, 167u, 234u, 131u, 147u, 250u, 47u, 136u, 236u, 20u, 128u, 94u, 251u,
    171u, 133u, 25u, 203u, 55u, 218u, 188u, 241u, 75u, 180u, 221u, 158u, 140u, 97u, 239u, 61u, 180u, 228u, 75u, 234u,
    155u, 59u, 134u, 72u, 19u, 101u, 186u, 85u, 213u, 97u, 250u, 136u, 62u, 25u, 96u, 113u, 241u, 152u, 30u, 14u, 249u,
    94u, 67u, 104u, 226u, 195u, 250u, 32u, 103u, 43u, 187u, 65u, 100u, 42u, 3u, 85u, 23u, 160u, 100u, 197u, 73u, 168u,
    39u, 113u, 66u, 184u, 235u, 164u, 116u, 0u, 126u, 151u, 209u, 18u, 84u, 123u, 3u, 194u, 163u, 18u, 125u, 41u, 24u,
    186u, 118u, 208u, 253u, 31u, 163u, 238u, 65u, 230u, 22u, 194u, 179u, 108u, 215u, 159u, 202u, 37u, 175u, 133u, 73u,
    185u, 111u, 217u, 167u, 18u, 138u, 56u, 153u, 4u, 223u, 78u, 161u, 29u, 150u, 199u, 119u, 184u, 222u, 62u, 212u,
    119u, 29u, 244u, 145u, 218u, 17u, 100u, 35u, 138u, 252u, 69u, 171u, 40u, 103u, 135u, 252u, 33u, 214u, 48u, 112u,
    204u, 93u, 145u, 167u, 97u, 48u, 5u, 193u, 92u, 116u, 46u, 140u, 155u, 37u, 129u, 49u, 5u, 146u, 74u, 127u, 52u, 90u,
    231u, 211u, 161u, 44u, 147u, 201u, 232u, 41u, 91u, 129u, 179u, 205u, 244u, 116u, 89u, 219u, 242u, 71u, 105u, 238u,
    36u, 176u, 153u, 53u, 204u, 77u, 191u, 157u, 242u, 86u, 215u, 23u, 192u, 90u, 228u, 12u, 202u, 170u, 70u, 182u,
    235u, 80u, 30u, 254u, 213u, 65u, 243u, 221u, 141u, 77u, 171u, 218u, 197u, 7u, 105u, 171u, 226u, 89u, 241u, 33u,
    229u, 180u, 248u, 21u, 105u, 4u, 60u, 84u, 130u, 32u, 76u, 186u, 238u, 110u, 68u, 50u, 139u, 24u, 174u, 8u, 135u,
    53u, 169u, 13u, 134u, 88u, 1u, 229u, 105u, 131u, 8u, 51u, 124u, 61u, 179u, 108u, 48u, 144u, 244u, 64u, 115u, 51u,
    145u, 101u, 129u, 154u, 57u, 175u, 2u, 84u, 128u, 159u, 109u, 16u, 57u, 244u, 127u, 80u, 251u, 203u, 70u, 118u,
    165u, 191u, 102u, 15u, 67u, 166u, 196u, 142u, 242u, 190u, 10u, 251u, 120u, 158u, 9u, 216u, 166u, 14u, 98u, 234u,
    61u, 188u, 38u, 209u, 151u, 196u, 113u, 255u, 67u, 186u, 24u, 91u, 173u, 227u, 200u, 12u, 234u, 159u, 211u, 122u,
    30u, 163u, 86u, 196u, 219u, 22u, 9u, 225u, 188u, 136u, 115u, 196u, 19u, 36u, 237u, 184u, 152u, 40u, 27u, 181u, 59u,
    15u, 150u, 25u, 55u, 80u, 137u, 209u, 153u, 221u, 124u, 38u, 113u, 225u, 100u, 175u, 63u, 208u, 83u, 29u, 255u,
    194u, 152u, 204u, 123u, 81u, 251u, 95u, 21u, 76u, 47u, 218u, 144u, 163u, 240u, 211u, 41u, 110u, 151u, 79u, 39u, 98u,
    8u, 75u, 223u, 187u, 5u, 239u, 42u, 161u, 247u, 74u, 95u, 41u, 233u, 52u, 170u, 204u, 63u, 96u, 213u, 135u, 112u,
    208u, 96u, 138u, 223u, 178u, 216u, 251u, 7u, 116u, 49u, 86u, 26u, 75u, 170u, 53u, 213u, 21u, 149u, 46u, 103u, 142u,
    119u, 37u, 73u, 227u, 17u, 108u, 159u, 216u, 125u, 233u, 181u, 99u, 38u, 118u, 58u, 137u, 71u, 251u, 29u, 133u,
);

@fragment
fn fs_palettized(in: FragmentInput, @builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4<f32> {
    let pixel_srgb = textureSample(t_input, s_input, in.tex_coord);

    if pixel_srgb.a * 255.0 < f32(config.transparency_threshold) {
        return vec4<f32>(0.0, 0.0, 0.0, 0.0);
    }

    var pixel_to_process_linear = pixel_srgb.rgb;

    // Dithering: 1u is FS (not possible in fragment shader), 2u is Blue-Noise
    if config.dither_algorithm == 2u { // Blue-Noise Dithering
        let x = u32(frag_coord.x);
        let y = u32(frag_coord.y);

        let xi = x % NOISE_DIM;
        let yi = y % NOISE_DIM;
        let noise_index = yi * NOISE_DIM + xi;
        let mask = BLUE_NOISE_64X64[noise_index];

        let noise_val = (f32(mask) - 127.5) * config.dither_strength;

        let r_srgb = pow(pixel_to_process_linear.r, 1.0 / 2.2) * 255.0;
        let g_srgb = pow(pixel_to_process_linear.g, 1.0 / 2.2) * 255.0;
        let b_srgb = pow(pixel_to_process_linear.b, 1.0 / 2.2) * 255.0;

        let r_dithered = clamp(r_srgb + noise_val, 0.0, 255.0);
        let g_dithered = clamp(g_srgb + noise_val, 0.0, 255.0);
        let b_dithered = clamp(b_srgb + noise_val, 0.0, 255.0);

        pixel_to_process_linear = pow(vec3<f32>(r_dithered, g_dithered, b_dithered) / 255.0, vec3<f32>(2.2));
    }

    let pixel_lab = linear_rgb_to_lab(pixel_to_process_linear);

    var min_dist = 1e20;
    var best_index = 0u;
    for (var i = 0u; i < config.palette_size; i = i + 1u) {
        let pal_lab = rgba_to_lab(color_at(i));
        let d = delta_e(pixel_lab, pal_lab, config.diff_formula);
        if d < min_dist {
            min_dist = d;
            best_index = i;
        }
    }

    let quantized_packed_srgb = color_at(best_index);

    let r_final_srgb = f32((quantized_packed_srgb >> 0u) & 0xFFu) / 255.0;
    let g_final_srgb = f32((quantized_packed_srgb >> 8u) & 0xFFu) / 255.0;
    let b_final_srgb = f32((quantized_packed_srgb >> 16u) & 0xFFu) / 255.0;

    let final_rgb_linear = pow(vec3<f32>(r_final_srgb, g_final_srgb, b_final_srgb), vec3<f32>(2.2));

    return vec4<f32>(final_rgb_linear, pixel_srgb.a);
}


const WHITE_X: f32 = 95.047;
const WHITE_Y: f32 = 100.000;
const WHITE_Z: f32 = 108.883;
const EPSILON: f32 = 0.008856;
const KAPPA: f32 = 903.3;
const PI_MATH: f32 = 3.141592653589793;
const POW25_7: f32 = 6103515625.0; // 25^7

fn delta_e(lab1: Lab, lab2: Lab, formula: u32) -> f32 {
    if formula == 0u { // CIE76
        return cie76(lab1, lab2);
    } else if formula == 1u { // CIE94
        return cie94(lab1, lab2);
    } else { // CIEDE2000
        return ciede2000(lab1, lab2);
    }
}

fn cie76(lab1: Lab, lab2: Lab) -> f32 {
    let dl: f32 = lab1.l - lab2.l;
    let da: f32 = lab1.a - lab2.a;
    let db: f32 = lab1.b - lab2.b;
    return sqrt(dl * dl + da * da + db * db);
}

fn cie94(lab1: Lab, lab2: Lab) -> f32 {
    let kL: f32 = 1.0;
    let k1: f32 = 0.045;
    let k2: f32 = 0.015;

    let delta_l: f32 = lab1.l - lab2.l;
    let c1: f32 = sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
    let c2: f32 = sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
    let delta_c: f32 = c1 - c2;
    let delta_a: f32 = lab1.a - lab2.a;
    let delta_b: f32 = lab1.b - lab2.b;
    let delta_h_sq: f32 = delta_a * delta_a + delta_b * delta_b - delta_c * delta_c;
    let delta_h: f32 = select(0.0, sqrt(delta_h_sq), delta_h_sq > 0.0);
    let sL: f32 = 1.0;
    let sC: f32 = 1.0 + k1 * c1;
    let sH: f32 = 1.0 + k2 * c1;
    let term_L: f32 = delta_l / (kL * sL);
    let term_C: f32 = delta_c / sC;
    let term_H: f32 = delta_h / sH;

    return sqrt(term_L * term_L + term_C * term_C + term_H * term_H);
}

fn ciede2000(lab1_in: Lab, lab2_in: Lab) -> f32 {
    let ref_l: f32 = lab1_in.l;
    let ref_a: f32 = lab1_in.a;
    let ref_b: f32 = lab1_in.b;
    let comp_l: f32 = lab2_in.l;
    let comp_a: f32 = lab2_in.a;
    let comp_b: f32 = lab2_in.b;
    let l_bar_prime: f32 = (ref_l + comp_l) * 0.5;
    let c1_std: f32 = sqrt(ref_a * ref_a + ref_b * ref_b);
    let c2_std: f32 = sqrt(comp_a * comp_a + comp_b * comp_b);
    let c_bar_std: f32 = (c1_std + c2_std) * 0.5;
    let c_bar_std_pow7: f32 = pow(c_bar_std, 7.0);
    let G_val_term: f32 = c_bar_std_pow7 / (c_bar_std_pow7 + POW25_7);
    let G_val: f32 = 0.5 * (1.0 - sqrt(G_val_term));
    let a1_prime: f32 = ref_a * (1.0 + G_val);
    let a2_prime: f32 = comp_a * (1.0 + G_val);
    let c1_prime: f32 = sqrt(a1_prime * a1_prime + ref_b * ref_b);
    let c2_prime: f32 = sqrt(a2_prime * a2_prime + comp_b * comp_b);
    var h1_prime_deg: f32 = 0.0;
    if c1_prime != 0.0 {
        h1_prime_deg = atan2(ref_b, a1_prime) * (180.0 / PI_MATH);
        if h1_prime_deg < 0.0 {
            h1_prime_deg = h1_prime_deg + 360.0;
        }
    }
    var h2_prime_deg: f32 = 0.0;
    if c2_prime != 0.0 {
        h2_prime_deg = atan2(comp_b, a2_prime) * (180.0 / PI_MATH);
        if h2_prime_deg < 0.0 {
            h2_prime_deg = h2_prime_deg + 360.0;
        }
    }
    let delta_l_prime: f32 = comp_l - ref_l;
    let delta_c_prime: f32 = c2_prime - c1_prime;
    var actual_delta_h_prime_degrees: f32;
    if c1_prime == 0.0 || c2_prime == 0.0 {
        actual_delta_h_prime_degrees = 0.0;
    } else {
        let h_diff: f32 = h2_prime_deg - h1_prime_deg;
        if abs(h_diff) <= 180.0 {
            actual_delta_h_prime_degrees = h_diff;
        } else {
            let sign_val = select(-1.0, 1.0, h2_prime_deg <= h1_prime_deg);
            actual_delta_h_prime_degrees = h_diff + sign_val * 360.0;
        }
    }
    let delta_H_prime_big: f32 = 2.0 * sqrt(c1_prime * c2_prime) * sin((actual_delta_h_prime_degrees * PI_MATH / 180.0) / 2.0);
    let l_bar_prime_minus_50: f32 = l_bar_prime - 50.0;
    let l_bar_prime_minus_50_sq: f32 = l_bar_prime_minus_50 * l_bar_prime_minus_50;
    let s_l: f32 = 1.0 + (0.015 * l_bar_prime_minus_50_sq) / sqrt(20.0 + l_bar_prime_minus_50_sq);
    let c_bar_prime: f32 = (c1_prime + c2_prime) * 0.5;
    let s_c: f32 = 1.0 + 0.045 * c_bar_prime;
    var H_bar_prime_deg: f32;
    if c1_prime == 0.0 || c2_prime == 0.0 {
        H_bar_prime_deg = h1_prime_deg + h2_prime_deg;
    } else {
        let sum_h_primes_deg = h1_prime_deg + h2_prime_deg;
        if abs(h1_prime_deg - h2_prime_deg) <= 180.0 {
            H_bar_prime_deg = sum_h_primes_deg / 2.0;
        } else {
            let offset_hbar = select(-360.0, 360.0, sum_h_primes_deg < 360.0);
            H_bar_prime_deg = (sum_h_primes_deg + offset_hbar) / 2.0;
        }
    }
    var t_val: f32 = 1.0;
    t_val = t_val - 0.17 * cos((H_bar_prime_deg - 30.0) * PI_MATH / 180.0);
    t_val = t_val + 0.24 * cos((2.0 * H_bar_prime_deg) * PI_MATH / 180.0);
    t_val = t_val + 0.32 * cos((3.0 * H_bar_prime_deg + 6.0) * PI_MATH / 180.0);
    t_val = t_val - 0.20 * cos((4.0 * H_bar_prime_deg - 63.0) * PI_MATH / 180.0);
    let s_h: f32 = 1.0 + 0.015 * c_bar_prime * t_val;
    let c_bar_prime_pow7: f32 = pow(c_bar_prime, 7.0);
    let R_C_term_sqrt: f32 = sqrt(c_bar_prime_pow7 / (c_bar_prime_pow7 + POW25_7));
    let h_bar_prime_deg_norm_exp: f32 = (H_bar_prime_deg - 275.0) / 25.0;
    let exp_term_for_rot: f32 = exp(-(h_bar_prime_deg_norm_exp * h_bar_prime_deg_norm_exp));
    let angle_for_sin_rot: f32 = exp_term_for_rot * (60.0 * PI_MATH / 180.0);
    let r_t: f32 = -2.0 * R_C_term_sqrt * sin(angle_for_sin_rot);
    let term_L: f32 = delta_l_prime / s_l;
    let term_C: f32 = delta_c_prime / s_c;
    let term_H: f32 = delta_H_prime_big / s_h;
    let sum_terms: f32 = term_L * term_L + term_C * term_C + term_H * term_H + r_t * term_C * term_H;
    return sqrt(sum_terms);
}

fn lab_to_linear_rgb(lab: Lab) -> vec3<f32> {
    let y = (lab.l + 16.0) / 116.0;
    let x = lab.a / 500.0 + y;
    let z = y - lab.b / 200.0;

    let x3 = x * x * x;
    let z3 = z * z * z;

    var xyz_x = WHITE_X * (select((x - 16.0 / 116.0) / 7.787, x3, x3 > EPSILON));
    var xyz_y = WHITE_Y * (select(lab.l / KAPPA, pow((lab.l + 16.0) / 116.0, 3.0), lab.l > (KAPPA * EPSILON)));
    var xyz_z = WHITE_Z * (select((z - 16.0 / 116.0) / 7.787, z3, z3 > EPSILON));

    xyz_x = xyz_x / 100.0;
    xyz_y = xyz_y / 100.0;
    xyz_z = xyz_z / 100.0;

    let r = xyz_x * 3.2404542 - xyz_y * 1.5371385 - xyz_z * 0.4985314;
    let g = xyz_x * -0.969266 + xyz_y * 1.8760108 + xyz_z * 0.0415560;
    let b = xyz_x * 0.0556434 - xyz_y * 0.2040259 + xyz_z * 1.0572252;

    return clamp(vec3<f32>(r, g, b), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn pivot_xyz(n: f32) -> f32 {
    if n > EPSILON {
        return pow(n, 1.0 / 3.0);
    } else {
        return (KAPPA * n + 16.0) / 116.0;
    }
}

fn linear_rgb_to_lab(rgb_lin: vec3<f32>) -> Lab {
    let x_xyz: f32 = (rgb_lin.r * 0.4124564 + rgb_lin.g * 0.3575761 + rgb_lin.b * 0.1804375) * 100.0;
    let y_xyz: f32 = (rgb_lin.r * 0.2126729 + rgb_lin.g * 0.7151522 + rgb_lin.b * 0.0721750) * 100.0;
    let z_xyz: f32 = (rgb_lin.r * 0.0193339 + rgb_lin.g * 0.1191920 + rgb_lin.b * 0.9503041) * 100.0;

    let xr: f32 = x_xyz / WHITE_X;
    let yr: f32 = y_xyz / WHITE_Y;
    let zr: f32 = z_xyz / WHITE_Z;

    let fx: f32 = pivot_xyz(xr);
    let fy: f32 = pivot_xyz(yr);
    let fz: f32 = pivot_xyz(zr);

    let l_star: f32 = max(0.0, 116.0 * fy - 16.0);
    let a_star: f32 = 500.0 * (fx - fy);
    let b_star: f32 = 200.0 * (fy - fz);

    return Lab(l_star, a_star, b_star, 0.0);
}

fn rgba_to_lab(rgba: u32) -> Lab {
    let r_u8: f32 = f32(rgba & 0xFFu);
    let g_u8: f32 = f32((rgba >> 8u) & 0xFFu);
    let b_u8: f32 = f32((rgba >> 16u) & 0xFFu);

    let r_lin: f32 = pow(r_u8 / 255.0, 2.2);
    let g_lin: f32 = pow(g_u8 / 255.0, 2.2);
    let b_lin: f32 = pow(b_u8 / 255.0, 2.2);

    return linear_rgb_to_lab(vec3<f32>(r_lin, g_lin, b_lin));
}

fn color_at(index: u32) -> u32 {
    let vec_idx = index / 4u;
    let component_idx = index % 4u;
    return config.palette[vec_idx][component_idx];
}
