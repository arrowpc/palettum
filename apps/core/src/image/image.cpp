#include "image/image.h"

Image::Image(const unsigned char *buffer, int length)
{
    // Try PNG
    spng_ctx *ctx = spng_ctx_new(0);
    if (ctx && spng_set_png_buffer(ctx, buffer, length) == 0)
    {
        struct spng_ihdr ihdr;
        if (spng_get_ihdr(ctx, &ihdr) == 0)
        {
            bool has_alpha =
                (ihdr.color_type == SPNG_COLOR_TYPE_TRUECOLOR_ALPHA ||
                 ihdr.color_type == SPNG_COLOR_TYPE_GRAYSCALE_ALPHA);
            if (ihdr.color_type == SPNG_COLOR_TYPE_INDEXED)
            {
                struct spng_trns trns;
                has_alpha = (spng_get_trns(ctx, &trns) == 0);
            }
            int fmt = has_alpha ? SPNG_FMT_RGBA8 : SPNG_FMT_RGB8;
            m_channels = has_alpha ? 4 : 3;

            size_t image_size;
            if (spng_decoded_image_size(ctx, fmt, &image_size) == 0)
            {
                m_data.resize(image_size);
                if (spng_decode_image(ctx, m_data.data(), image_size, fmt, 0) ==
                    0)
                {
                    m_width = ihdr.width;
                    m_height = ihdr.height;
                    spng_ctx_free(ctx);
                    return;  // Success
                }
            }
        }
    }
    spng_ctx_free(ctx);  // Clean up if PNG failed

    // Try JPEG
    tjhandle tjInstance = tjInitDecompress();
    if (!tjInstance)
    {
        throw std::runtime_error(
            "Failed to initialize libjpeg-turbo decompressor");
    }

    int width, height, subsamp, colorspace;
    if (tjDecompressHeader3(tjInstance, buffer, length, &width, &height,
                            &subsamp, &colorspace) == 0)
    {
        m_width = width;
        m_height = height;
        m_channels =
            3;  // JPEG typically decodes to RGB; we'll use TJFLAG_FASTDCT for speed
        m_data.resize(m_width * m_height * m_channels);

        if (tjDecompress2(tjInstance, buffer, length, m_data.data(), m_width,
                          0 /* pitch */, m_height, TJPF_RGB,
                          TJFLAG_FASTDCT) != 0)
        {
            tjDestroy(tjInstance);
            throw std::runtime_error(
                std::string("Failed to decompress JPEG: ") +
                tjGetErrorStr2(tjInstance));
        }
        tjDestroy(tjInstance);
        return;  // Success
    }

    tjDestroy(tjInstance);
    throw std::runtime_error(
        "Failed to load image from memory: not a valid PNG or JPEG");
}

Image::Image(const std::string &filename)
    : Image(filename.c_str())
{
}

Image::Image(const char *filename)
{
    std::string fname(filename);
    std::transform(fname.begin(), fname.end(), fname.begin(), ::tolower);

    if (fname.ends_with(".png"))
    {
        FILE *png_file = fopen(filename, "rb");
        if (!png_file)
        {
            throw std::runtime_error("Failed to open PNG file: " +
                                     std::string(filename));
        }

        spng_ctx *ctx = spng_ctx_new(0);
        if (!ctx || spng_set_png_file(ctx, png_file) != 0)
        {
            if (ctx)
                spng_ctx_free(ctx);
            fclose(png_file);
            throw std::runtime_error("Failed to set up libspng context");
        }

        struct spng_ihdr ihdr;
        if (spng_get_ihdr(ctx, &ihdr) != 0)
        {
            spng_ctx_free(ctx);
            fclose(png_file);
            throw std::runtime_error("Failed to get PNG IHDR");
        }

        bool has_alpha = (ihdr.color_type == SPNG_COLOR_TYPE_TRUECOLOR_ALPHA ||
                          ihdr.color_type == SPNG_COLOR_TYPE_GRAYSCALE_ALPHA);
        if (ihdr.color_type == SPNG_COLOR_TYPE_INDEXED)
        {
            struct spng_trns trns;
            has_alpha = (spng_get_trns(ctx, &trns) == 0);
        }
        int fmt = has_alpha ? SPNG_FMT_RGBA8 : SPNG_FMT_RGB8;
        m_channels = has_alpha ? 4 : 3;

        size_t image_size;
        if (spng_decoded_image_size(ctx, fmt, &image_size) != 0)
        {
            spng_ctx_free(ctx);
            fclose(png_file);
            throw std::runtime_error("Failed to calculate decoded PNG size");
        }

        m_data.resize(image_size);
        if (spng_decode_image(ctx, m_data.data(), image_size, fmt, 0) != 0)
        {
            spng_ctx_free(ctx);
            fclose(png_file);
            throw std::runtime_error("Failed to decode PNG");
        }

        m_width = ihdr.width;
        m_height = ihdr.height;
        spng_ctx_free(ctx);
        fclose(png_file);
    }
    else if (fname.ends_with(".jpg") || fname.ends_with(".jpeg"))
    {
        tjhandle tjInstance = tjInitDecompress();
        if (!tjInstance)
        {
            throw std::runtime_error(
                "Failed to initialize libjpeg-turbo decompressor");
        }

        FILE *jpg_file = fopen(filename, "rb");
        if (!jpg_file)
        {
            tjDestroy(tjInstance);
            throw std::runtime_error("Failed to open JPEG file: " +
                                     std::string(filename));
        }

        fseek(jpg_file, 0, SEEK_END);
        unsigned long size = ftell(jpg_file);
        fseek(jpg_file, 0, SEEK_SET);
        std::vector<unsigned char> buffer(size);
        if (fread(buffer.data(), 1, size, jpg_file) != size)
        {
            fclose(jpg_file);
            tjDestroy(tjInstance);
            throw std::runtime_error("Failed to read JPEG file");
        }
        fclose(jpg_file);

        int width, height, subsamp, colorspace;
        if (tjDecompressHeader3(tjInstance, buffer.data(), size, &width,
                                &height, &subsamp, &colorspace) != 0)
        {
            tjDestroy(tjInstance);
            throw std::runtime_error(
                std::string("Failed to parse JPEG header: ") +
                tjGetErrorStr2(tjInstance));
        }

        m_width = width;
        m_height = height;
        m_channels = 3;  // RGB output
        m_data.resize(m_width * m_height * m_channels);

        if (tjDecompress2(tjInstance, buffer.data(), size, m_data.data(),
                          m_width, 0 /* pitch */, m_height, TJPF_RGB,
                          TJFLAG_FASTDCT) != 0)
        {
            tjDestroy(tjInstance);
            throw std::runtime_error(
                std::string("Failed to decompress JPEG: ") +
                tjGetErrorStr2(tjInstance));
        }

        tjDestroy(tjInstance);
    }
    else
    {
        throw std::runtime_error("Unsupported file format: " +
                                 std::string(filename));
    }
}

Image::Image(int width, int height)
    : m_width(width)
    , m_height(height)
    , m_data(size())
{
}

Image::Image(int width, int height, bool withAlpha)
    : m_width(width)
    , m_height(height)
    , m_channels(withAlpha ? 4 : 3)
    , m_data(width * height * (withAlpha ? 4 : 3))
{
}

int Image::operator-(const Image &other) const
{
    if (m_width != other.m_width || m_height != other.m_height)
    {
        throw std::invalid_argument(
            "Images must have the same dimensions to calculate "
            "difference");
    }

    int differentPixels = 0;

    for (int y = 0; y < m_height; ++y)
    {
        for (int x = 0; x < m_width; ++x)
        {
            RGB thisColor = get(x, y);
            RGB otherColor = other.get(x, y);

            if (abs(thisColor.red() - otherColor.red()) > 5 ||
                abs(thisColor.green() - otherColor.green()) > 5 ||
                abs(thisColor.blue() - otherColor.blue()) > 5)
            {
                differentPixels++;
            }
        }
    }

    return differentPixels;
}

void Image::setPalette(const std::vector<RGB> &palette)
{
    if (palette.empty())
    {
        m_hasPalette = false;
        m_palette.clear();
    }
    else
    {
        m_palette = palette;
        m_hasPalette = true;
    }
}

std::vector<unsigned char> Image::write() const
{
    std::vector<uint8_t> result;

    if (m_hasPalette && (m_mapping == Mapping::CIEDE_PALETTIZED ||
                         m_mapping == Mapping::RBF_PALETTIZED))
        return writeIndexedToMemory();
    else
    {  // write as JPEG as fallback for UNTOUCHED, intended for INTERPOLATED
        if (m_mapping == Mapping::UNTOUCHED)
            std::cout << "Nothing done with file, writing as JPEG as fallback"
                      << std::endl;

        tjhandle tjInstance = tjInitCompress();
        if (!tjInstance)
        {
            throw std::runtime_error(
                "Failed to initialize libjpeg-turbo compressor");
        }

        unsigned char *jpegBuf = nullptr;
        unsigned long jpegSize = 0;
        int quality = 75;
        int subsamp = TJSAMP_420;
        int pixel_format = (m_channels == 4) ? TJPF_RGBA : TJPF_RGB;

        if (tjCompress2(tjInstance, m_data.data(), m_width, 0 /* pitch */,
                        m_height, pixel_format, &jpegBuf, &jpegSize, subsamp,
                        quality, TJFLAG_FASTDCT) != 0)
        {
            tjFree(jpegBuf);
            tjDestroy(tjInstance);
            throw std::runtime_error(std::string("Failed to compress JPEG: ") +
                                     tjGetErrorStr2(tjInstance));
        }

        result.assign(jpegBuf, jpegBuf + jpegSize);
        tjFree(jpegBuf);
        tjDestroy(tjInstance);
    }
    return result;
}

std::vector<unsigned char> Image::writeIndexedToMemory() const
{
    if (!m_hasPalette)
    {
        return write();
    }

    std::vector<unsigned char> buffer;
    auto write_callback = [](void *user_data, const uint8_t *p_bytes,
                             size_t len) -> size_t {
        auto *buf = static_cast<std::vector<unsigned char> *>(user_data);
        const size_t old_size = buf->size();
        buf->resize(old_size + len);
        std::memcpy(buf->data() + old_size, p_bytes, len);
        return len;
    };

    auto flush_callback = [](void *user_data) -> bool {
        return true;
    };

    mtpng_encoder *encoder = nullptr;
    mtpng_encoder_options *options = nullptr;
    mtpng_header *header = nullptr;

    if (mtpng_encoder_options_new(&options) != MTPNG_RESULT_OK)
    {
        throw std::runtime_error("Failed to create PNG encoder options");
    }

    if (mtpng_encoder_new(&encoder, write_callback, flush_callback, &buffer,
                          options) != MTPNG_RESULT_OK)
    {
        mtpng_encoder_options_release(&options);
        throw std::runtime_error("Failed to create PNG encoder");
    }
    mtpng_encoder_options_release(&options);

    if (mtpng_header_new(&header) != MTPNG_RESULT_OK ||
        mtpng_header_set_size(header, m_width, m_height) != MTPNG_RESULT_OK ||
        mtpng_header_set_color(header, MTPNG_COLOR_INDEXED_COLOR, 8) !=
            MTPNG_RESULT_OK)
    {
        mtpng_encoder_release(&encoder);
        throw std::runtime_error("Failed to configure PNG header");
    }

    if (mtpng_encoder_write_header(encoder, header) != MTPNG_RESULT_OK)
    {
        mtpng_header_release(&header);
        mtpng_encoder_release(&encoder);
        throw std::runtime_error("Failed to write PNG header");
    }
    mtpng_header_release(&header);

    bool needsTransparency = false;
    uint8_t transparentIndex = 0;

    if (m_channels == 4)
    {
        for (int i = 0; i < m_width * m_height; ++i)
        {
            if (m_data[i * 4 + 3] == 0)
            {
                needsTransparency = true;
                break;
            }
        }
    }

    std::unordered_map<uint32_t, uint8_t> colorMap;
    colorMap.reserve(m_palette.size());

    for (size_t j = 0; j < m_palette.size(); ++j)
    {
        uint32_t key = (m_palette[j].red() << 16) |
                       (m_palette[j].green() << 8) | m_palette[j].blue();
        colorMap[key] = j;
    }

    std::vector<uint8_t> palette;
    palette.reserve((m_palette.size() + (needsTransparency ? 1 : 0)) * 3);

    for (const auto &color : m_palette)
    {
        palette.push_back(color.red());
        palette.push_back(color.green());
        palette.push_back(color.blue());
    }

    if (needsTransparency && m_channels == 4)
    {
        palette.push_back(0);
        palette.push_back(0);
        palette.push_back(0);

        transparentIndex = m_palette.size();
    }

    if (mtpng_encoder_write_palette(encoder, palette.data(), palette.size()) !=
        MTPNG_RESULT_OK)
    {
        mtpng_encoder_release(&encoder);
        throw std::runtime_error("Failed to write palette chunk");
    }

    if (needsTransparency && m_channels == 4)
    {
        std::vector<uint8_t> transparency(m_palette.size() + 1, 255);

        transparency[transparentIndex] = 0;

        if (mtpng_encoder_write_transparency(encoder, transparency.data(),
                                             transparency.size()) !=
            MTPNG_RESULT_OK)
        {
            mtpng_encoder_release(&encoder);
            throw std::runtime_error("Failed to write transparency");
        }
    }

    std::vector<uint8_t> indexed_data(m_width * m_height);

    if (m_channels == 3)
    {
        for (int i = 0; i < m_width * m_height; ++i)
        {
            uint32_t colorKey = (m_data[i * 3] << 16) |
                                (m_data[i * 3 + 1] << 8) | m_data[i * 3 + 2];
            indexed_data[i] = colorMap[colorKey];
        }
    }
    else
    {
        for (int i = 0; i < m_width * m_height; ++i)
        {
            if (m_data[i * 4 + 3] == 0)
            {
                indexed_data[i] = transparentIndex;
            }
            else
            {
                uint32_t colorKey = (m_data[i * 4] << 16) |
                                    (m_data[i * 4 + 1] << 8) |
                                    m_data[i * 4 + 2];
                indexed_data[i] = colorMap[colorKey];
            }
        }
    }

    if (mtpng_encoder_write_image_rows(encoder, indexed_data.data(),
                                       indexed_data.size()) != MTPNG_RESULT_OK)
    {
        mtpng_encoder_release(&encoder);
        throw std::runtime_error("Failed to write image data");
    }

    mtpng_result result = mtpng_encoder_finish(&encoder);

    if (result != MTPNG_RESULT_OK)
    {
        throw std::runtime_error("Failed to finalize PNG encoding");
    }

    return buffer;
}

bool Image::write(const std::string &filename) const
{
    return write(filename.c_str());
}

bool Image::write(const char *filename) const
{
    if (m_hasPalette && (m_mapping == Mapping::CIEDE_PALETTIZED ||
                         m_mapping == Mapping::RBF_PALETTIZED))
        writeIndexed(filename);
    else
    {  // write as JPEG as fallback for UNTOUCHED, intended for INTERPOLATED
        if (m_mapping == Mapping::UNTOUCHED)
            std::cout << "Nothing done with file, writing as JPEG as fallback"
                      << std::endl;

        tjhandle tjInstance = tjInitCompress();
        if (!tjInstance)
        {
            throw std::runtime_error(
                "Failed to initialize libjpeg-turbo compressor");
        }

        FILE *fp = fopen(filename, "wb");
        if (!fp)
        {
            tjDestroy(tjInstance);
            throw std::runtime_error("Failed to open file for writing: " +
                                     std::string(filename));
        }

        unsigned char *jpegBuf = nullptr;
        unsigned long jpegSize = 0;
        int quality = 75;
        int subsamp = TJSAMP_420;
        int pixel_format = (m_channels == 4) ? TJPF_RGBA : TJPF_RGB;

        if (tjCompress2(tjInstance, m_data.data(), m_width, 0 /* pitch */,
                        m_height, pixel_format, &jpegBuf, &jpegSize, subsamp,
                        quality, TJFLAG_FASTDCT) != 0)
        {
            tjFree(jpegBuf);
            tjDestroy(tjInstance);
            fclose(fp);
            throw std::runtime_error(std::string("Failed to compress JPEG: ") +
                                     tjGetErrorStr2(tjInstance));
        }

        if (fwrite(jpegBuf, 1, jpegSize, fp) != jpegSize)
        {
            tjFree(jpegBuf);
            tjDestroy(tjInstance);
            fclose(fp);
            throw std::runtime_error("Failed to write JPEG to file");
        }

        tjFree(jpegBuf);
        tjDestroy(tjInstance);
        fclose(fp);
        return true;
    }
    return false;
}

bool Image::writeIndexed(const std::string &filename) const
{
    if (!m_hasPalette)
    {
        return write(filename.c_str());
    }

    std::vector<unsigned char> buffer = writeIndexedToMemory();

    FILE *fp = std::fopen(filename.c_str(), "wb");
    if (!fp)
    {
        throw std::runtime_error("Failed to open file for writing");
    }

    size_t written = fwrite(buffer.data(), 1, buffer.size(), fp);
    fclose(fp);

    if (written != buffer.size())
    {
        throw std::runtime_error("Failed to write complete image data to file");
    }

    return true;
}

bool Image::resize(int width, int height)
{
    if (width <= 0 || height <= 0)
        throw std::out_of_range("Invalid resize dimensions");

    std::vector<uint8_t> new_data(width * height * m_channels);

    double x_ratio = static_cast<double>(m_width) / width;
    double y_ratio = static_cast<double>(m_height) / height;

    for (int y = 0; y < height; y++)
    {
        for (int x = 0; x < width; x++)
        {
            int src_x = static_cast<int>(x * x_ratio);
            int src_y = static_cast<int>(y * y_ratio);

            int src_pos = (src_y * m_width + src_x) * m_channels;
            int dst_pos = (y * width + x) * m_channels;

            for (int c = 0; c < m_channels; c++)
            {
                new_data[dst_pos + c] = m_data[src_pos + c];
            }
        }
    }

    m_data = std::move(new_data);
    m_width = width;
    m_height = height;

    return true;
}

RGBA Image::get(int x, int y) const
{
    validateCoordinates(x, y);
    size_t pos = (y * m_width + x) * m_channels;
    if (m_channels == 4)
    {
        return RGBA(m_data[pos], m_data[pos + 1], m_data[pos + 2],
                    m_data[pos + 3]);
    }
    return RGBA(m_data[pos], m_data[pos + 1], m_data[pos + 2], 255);
}

void Image::set(int x, int y, const RGBA &color)
{
    if (m_channels != 4)
        throw std::logic_error("Image does not have an alpha channel. Use "
                               "Image::set(int, int, const RGB&) instead.");

    validateCoordinates(x, y);
    size_t pos = (y * m_width + x) * m_channels;
    m_data[pos] = color.red();
    m_data[pos + 1] = color.green();
    m_data[pos + 2] = color.blue();
    m_data[pos + 3] = color.alpha();
}

void Image::set(int x, int y, const RGB &color)
{
    validateCoordinates(x, y);
    size_t pos = (y * m_width + x) * m_channels;
    m_data[pos] = color.red();
    m_data[pos + 1] = color.green();
    m_data[pos + 2] = color.blue();
    if (m_channels == 4)
        m_data[pos + 3] = 255;
}

int Image::width() const noexcept
{
    return m_width;
}

int Image::height() const noexcept
{
    return m_height;
}

int Image::channels() const noexcept
{
    return m_channels;
}

const uint8_t *Image::data() const noexcept
{
    return m_data.data();
}

bool Image::operator==(const Image &other) const
{
    return m_width == other.m_width && m_height == other.m_height &&
           m_data == other.m_data;
}

bool Image::operator!=(const Image &other) const
{
    return !(*this == other);
}

void Image::validateCoordinates(int x, int y) const
{
    if (x < 0 || x >= m_width || y < 0 || y >= m_height)
    {
        throw std::out_of_range("Given coordinates out of bounds");
    }
}

int Image::size() const noexcept
{
    return m_width * m_height * m_channels;
}
