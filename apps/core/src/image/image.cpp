#include "image/image.h"
#include <stdexcept>

#define STB_IMAGE_IMPLEMENTATION
#include <stb_image.h>

Image::Image(const unsigned char *buffer, int length)
{
    fpng::fpng_init();
    int width, height, channels;
    uint8_t *data =
        stbi_load_from_memory(buffer, length, &width, &height, &channels, 0);
    if (!data)
    {
        throw std::runtime_error(
            std::string("Failed to load image from memory: ") +
            stbi_failure_reason());
    }
    m_width = width;
    m_height = height;
    m_channels = channels;
    m_data.assign(data, data + (width * height * channels));
    stbi_image_free(data);
}

Image::Image(const std::string &filename)
    : Image(filename.c_str())
{
}

Image::Image(const char *filename)
{
    unsigned char *data =
        stbi_load(filename, &m_width, &m_height, &m_channels, 0);
    if (!data)
    {
        throw std::runtime_error("Failed to load image: " +
                                 std::string(filename));
    }
    m_data.assign(data, data + size());
    stbi_image_free(data);
}

Image::Image(int width, int height)
    : m_width(width)
    , m_height(height)
    , m_data(size())
{
    fpng::fpng_init();
}

Image::Image(int width, int height, bool withAlpha)
    : m_width(width)
    , m_height(height)
    , m_channels(withAlpha ? 4 : 3)
    , m_data(width * height * (withAlpha ? 4 : 3))
{
    fpng::fpng_init();
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
    {
        return writeIndexedToMemory();
    }
    else if (m_mapping == Mapping::UNTOUCHED)
    {
        bool written = fpng::fpng_encode_image_to_memory(
            m_data.data(), m_width, m_height, m_channels, result);

        if (!written)
        {
            throw std::runtime_error(
                std::string("Failed to write image to memory using fpng"));
        }
    }
    else if (m_mapping == Mapping::RBF_INTERPOLATED)
    {
        //TODO: Use JPEG for smaller file sizes as pixel accuracy isn't required
        bool written = fpng::fpng_encode_image_to_memory(
            m_data.data(), m_width, m_height, m_channels, result);

        if (!written)
        {
            throw std::runtime_error(
                std::string("Failed to write image to memory using fpng"));
        }
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
    else if (m_mapping == Mapping::UNTOUCHED)
    {
        bool written = fpng::fpng_encode_image_to_file(
            filename, m_data.data(), m_width, m_height, m_channels);

        if (!written)
        {
            throw std::runtime_error(
                std::string("Failed to write image using fpng"));
        }
        return written;
    }
    else if (m_mapping == Mapping::RBF_INTERPOLATED)
    {
        //TODO: Use JPEG for smaller file sizes as pixel accuracy isn't required
        bool written = fpng::fpng_encode_image_to_file(
            filename, m_data.data(), m_width, m_height, m_channels);

        if (!written)
        {
            throw std::runtime_error(
                std::string("Failed to write image using fpng"));
        }
        return written;
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
