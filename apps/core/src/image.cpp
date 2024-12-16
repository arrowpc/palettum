#include "image.h"
#include <stb_image.h>
#include <stb_image_resize2.h>
#include <stb_image_write.h>

Image::Image(const unsigned char *buffer, int length)
{
    int width, height, channels;
    uint8_t *data = stbi_load_from_memory(buffer, length, &width, &height,
                                          &channels, STBI_rgb);
    if (!data)
    {
        throw std::runtime_error(
            std::string("Failed to load image from memory: ") +
            stbi_failure_reason());
    }
    m_width = width;
    m_height = height;
    m_channels = 3;
    m_data.assign(data, data + (width * height * m_channels));
    stbi_image_free(data);
}

Image::Image(const std::string &filename)
    : Image(filename.c_str())
{
}

Image::Image(const char *filename)
{
    unsigned char *data =
        stbi_load(filename, &m_width, &m_height, &m_channels, 3);
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

std::vector<unsigned char> Image::write() const
{
    int len;
    unsigned char *png_data =
        stbi_write_png_to_mem(m_data.data(), m_width * m_channels, m_width,
                              m_height, m_channels, &len);
    if (!png_data)
    {
        return {};
    }

    std::vector<unsigned char> result(png_data, png_data + len);
    STBIW_FREE(png_data);

    return result;
}

bool Image::write(const std::string &filename) const
{
    return write(filename.c_str());
}

bool Image::write(const char *filename) const
{
    return stbi_write_png(filename, m_width, m_height, m_channels,
                          m_data.data(), m_width * m_channels);
}

bool Image::resize(int width, int height)
{
    bool res =
        stbir_resize_uint8_linear(m_data.data(), m_width, m_height, 0,
                                  m_data.data(), width, height, 0, STBIR_RGB);
    if (res)
    {
        m_width = width;
        m_height = height;
    }
    return res;
}

RGB Image::get(int x, int y) const
{
    validateCoordinates(x, y);
    size_t pos = (y * m_width + x) * m_channels;
    return RGB(m_data[pos], m_data[pos + 1], m_data[pos + 2]);
}

void Image::set(int x, int y, const RGB &RGB)
{
    validateCoordinates(x, y);
    size_t pos = (y * m_width + x) * m_channels;
    m_data[pos] = RGB.red();
    m_data[pos + 1] = RGB.green();
    m_data[pos + 2] = RGB.blue();
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
        throw std::out_of_range("RGB coordinates out of bounds");
    }
}

int Image::size() const noexcept
{
    return m_width * m_height * m_channels;
}

GIF::Frame::Frame(const Image &img)
    : image(img)
    , colorMap(nullptr, GifFreeMapObject)
    , delay_cs(10)
{
    indices.resize(img.width() * img.height());
}

GIF::Frame::Frame(const Frame &other)
    : image(other.image)
    , indices(other.indices)
    , colorMap(nullptr, GifFreeMapObject)
    , delay_cs(other.delay_cs)
    , disposal_method(other.disposal_method)
    , transparent_index(other.transparent_index)
    , has_transparency(other.has_transparency)
    , x_offset(other.x_offset)
    , y_offset(other.y_offset)
    , is_interlaced(other.is_interlaced)
{
    if (other.colorMap)
    {
        ColorMapObject *newMap =
            GifMakeMapObject(other.colorMap->ColorCount, nullptr);
        if (!newMap)
        {
            throw std::runtime_error("Failed to create color map");
        }

        for (int i = 0; i < other.colorMap->ColorCount; i++)
        {
            newMap->Colors[i] = other.colorMap->Colors[i];
        }
        newMap->ColorCount = other.colorMap->ColorCount;

        colorMap.reset(newMap);
    }
}

void GIF::Frame::setPixel(int x, int y, const RGB &color, GifByteType index)
{
    image.set(x, y, color);
    indices[y * image.width() + x] = index;
}

GifByteType GIF::Frame::getIndex(int x, int y) const
{
    return indices[y * image.width() + x];
}

GIF::GIF(const std::string &filename)
    : GIF(filename.c_str())
{
}

GIF::GIF(const char *filename)
    : m_globalColorMap(nullptr, GifFreeMapObject)
    , m_loop_count(0)
    , m_background_color_index(0)
    , m_has_global_color_map(false)
{
    int error = 0;
    GifFileType *gif = DGifOpenFileName(filename, &error);
    if (!gif)
    {
        throw std::runtime_error("Could not open gif file");
    }

    if (DGifSlurp(gif) != GIF_OK)
    {
        int closeError = 0;
        DGifCloseFile(gif, &closeError);
        throw std::runtime_error("Could not read gif file");
    }

    m_width = gif->SWidth;
    m_height = gif->SHeight;
    m_background_color_index = gif->SBackGroundColor;

    if (gif->SColorMap)
    {
        ColorMapObject *newMap = GifMakeMapObject(gif->SColorMap->ColorCount,
                                                  gif->SColorMap->Colors);
        if (!newMap)
        {
            int closeError = 0;
            DGifCloseFile(gif, &closeError);
            throw std::runtime_error("Failed to create global color map");
        }
        m_globalColorMap.reset(newMap);
        m_has_global_color_map = true;
    }

    for (int i = 0; i < gif->ExtensionBlockCount; i++)
    {
        ExtensionBlock *ext = &gif->ExtensionBlocks[i];
        if (ext->Function == APPLICATION_EXT_FUNC_CODE)
        {
            if (ext->ByteCount >= 11 &&
                strncmp((const char *)ext->Bytes, "NETSCAPE2.0", 11) == 0 &&
                ext[1].ByteCount >= 3)
            {
                m_loop_count = ext[1].Bytes[1] | (ext[1].Bytes[2] << 8);
                break;
            }
        }
    }

    std::vector<uint8_t> compositeBuffer;
    std::vector<GifByteType> compositeIndices;
    compositeBuffer.resize(m_width * m_height * 3);
    compositeIndices.resize(m_width * m_height);

    RGB bgColor;
    if (m_has_global_color_map &&
        m_background_color_index < m_globalColorMap->ColorCount)
    {
        GifColorType &color =
            m_globalColorMap->Colors[m_background_color_index];
        bgColor = RGB(color.Red, color.Green, color.Blue);
    }

    for (int i = 0; i < m_width * m_height; i++)
    {
        compositeBuffer[i * 3] = bgColor.red();
        compositeBuffer[i * 3 + 1] = bgColor.green();
        compositeBuffer[i * 3 + 2] = bgColor.blue();
        compositeIndices[i] = m_background_color_index;
    }

    for (int i = 0; i < gif->ImageCount; i++)
    {
        SavedImage *savedImage = &gif->SavedImages[i];

        Image frameImage(m_width, m_height);
        Frame frame(frameImage);

        frame.x_offset = savedImage->ImageDesc.Left;
        frame.y_offset = savedImage->ImageDesc.Top;
        frame.is_interlaced = savedImage->ImageDesc.Interlace;
        frame.disposal_method = 0;
        frame.transparent_index = -1;
        frame.has_transparency = false;
        frame.delay_cs = 10;

        readExtensions(savedImage, frame);

        if (savedImage->ImageDesc.ColorMap)
        {
            ColorMapObject *newMap =
                GifMakeMapObject(savedImage->ImageDesc.ColorMap->ColorCount,
                                 savedImage->ImageDesc.ColorMap->Colors);
            if (!newMap)
            {
                int closeError = 0;
                DGifCloseFile(gif, &closeError);
                throw std::runtime_error("Failed to create frame color map");
            }
            frame.colorMap.reset(newMap);
        }

        ColorMapObject *colorMap =
            frame.colorMap ? frame.colorMap.get() : m_globalColorMap.get();
        if (!colorMap)
        {
            int closeError = 0;
            DGifCloseFile(gif, &closeError);
            throw std::runtime_error("No color map found for frame");
        }

        if (i > 0)
        {
            const Frame &prevFrame = m_frames.back();
            switch (prevFrame.disposal_method)
            {
                case DISPOSE_BACKGROUND:
                    for (int y = prevFrame.y_offset;
                         y < prevFrame.y_offset + prevFrame.image.height(); y++)
                    {
                        for (int x = prevFrame.x_offset;
                             x < prevFrame.x_offset + prevFrame.image.width();
                             x++)
                        {
                            if (x < m_width && y < m_height)
                            {
                                int pos = (y * m_width + x) * 3;
                                compositeBuffer[pos] = bgColor.red();
                                compositeBuffer[pos + 1] = bgColor.green();
                                compositeBuffer[pos + 2] = bgColor.blue();
                                compositeIndices[y * m_width + x] =
                                    m_background_color_index;
                            }
                        }
                    }
                    break;
                case DISPOSE_PREVIOUS:
                    // Not handling this case yet
                    break;
                default:
                    break;
            }
        }

        for (int y = 0; y < m_height; y++)
        {
            for (int x = 0; x < m_width; x++)
            {
                if (x >= frame.x_offset &&
                    x < frame.x_offset + savedImage->ImageDesc.Width &&
                    y >= frame.y_offset &&
                    y < frame.y_offset + savedImage->ImageDesc.Height)
                {
                    int src_x = x - frame.x_offset;
                    int src_y = y - frame.y_offset;
                    int idx =
                        savedImage
                            ->RasterBits[src_y * savedImage->ImageDesc.Width +
                                         src_x];

                    if (!frame.has_transparency ||
                        idx != frame.transparent_index)
                    {
                        GifColorType &color = colorMap->Colors[idx];
                        RGB pixelColor(color.Red, color.Green, color.Blue);
                        int pos = (y * m_width + x) * 3;
                        compositeBuffer[pos] = color.Red;
                        compositeBuffer[pos + 1] = color.Green;
                        compositeBuffer[pos + 2] = color.Blue;
                        compositeIndices[y * m_width + x] = idx;
                        frame.setPixel(x, y, pixelColor, idx);
                    }
                    else
                    {
                        int pos = (y * m_width + x) * 3;
                        RGB pixelColor(compositeBuffer[pos],
                                       compositeBuffer[pos + 1],
                                       compositeBuffer[pos + 2]);
                        frame.setPixel(x, y, pixelColor,
                                       compositeIndices[y * m_width + x]);
                    }
                }
                else
                {
                    int pos = (y * m_width + x) * 3;
                    RGB pixelColor(compositeBuffer[pos],
                                   compositeBuffer[pos + 1],
                                   compositeBuffer[pos + 2]);
                    frame.setPixel(x, y, pixelColor,
                                   compositeIndices[y * m_width + x]);
                }
            }
        }

        m_frames.push_back(std::move(frame));
    }

    DGifCloseFile(gif, &error);
}

GIF::GIF(int width, int height)
    : m_width(width)
    , m_height(height)
    , m_globalColorMap(nullptr, GifFreeMapObject)
    , m_loop_count(0)
    , m_background_color_index(0)
    , m_has_global_color_map(false)
{
}

int GIF::readFromMemory(GifFileType *gif, GifByteType *buf, int size)
{
    MemoryBuffer *memBuffer = (MemoryBuffer *)gif->UserData;
    if (memBuffer->position + size > memBuffer->length)
    {
        size = memBuffer->length - memBuffer->position;
    }
    if (size > 0)
    {
        memcpy(buf, memBuffer->data + memBuffer->position, size);
        memBuffer->position += size;
        return size;
    }
    return 0;
}

GIF::GIF(const unsigned char *buffer, int length)
    : m_globalColorMap(nullptr, GifFreeMapObject)
    , m_loop_count(0)
    , m_background_color_index(0)
    , m_has_global_color_map(false)
{
    int error = 0;
    MemoryBuffer memBuffer = {buffer, length, 0};

    GifFileType *gif = DGifOpen(&memBuffer, readFromMemory, &error);
    if (!gif)
    {
        throw std::runtime_error("Could not open gif from memory buffer");
    }

    if (DGifSlurp(gif) != GIF_OK)
    {
        int closeError = 0;
        DGifCloseFile(gif, &closeError);
        throw std::runtime_error(
            std::string("Could not read gif from memory: ") +
            GifErrorString(error));
    }

    m_width = gif->SWidth;
    m_height = gif->SHeight;
    m_background_color_index = gif->SBackGroundColor;

    if (gif->SColorMap)
    {
        ColorMapObject *newMap = GifMakeMapObject(gif->SColorMap->ColorCount,
                                                  gif->SColorMap->Colors);
        if (!newMap)
        {
            int closeError = 0;
            DGifCloseFile(gif, &closeError);
            throw std::runtime_error("Failed to create global color map");
        }
        m_globalColorMap.reset(newMap);
        m_has_global_color_map = true;
    }

    for (int i = 0; i < gif->ExtensionBlockCount; i++)
    {
        ExtensionBlock *ext = &gif->ExtensionBlocks[i];
        if (ext->Function == APPLICATION_EXT_FUNC_CODE)
        {
            if (ext->ByteCount >= 11 &&
                strncmp((const char *)ext->Bytes, "NETSCAPE2.0", 11) == 0 &&
                ext[1].ByteCount >= 3)
            {
                m_loop_count = ext[1].Bytes[1] | (ext[1].Bytes[2] << 8);
                break;
            }
        }
    }

    std::vector<uint8_t> compositeBuffer;
    std::vector<GifByteType> compositeIndices;
    compositeBuffer.resize(m_width * m_height * 3);
    compositeIndices.resize(m_width * m_height);

    RGB bgColor;
    if (m_has_global_color_map &&
        m_background_color_index < m_globalColorMap->ColorCount)
    {
        GifColorType &color =
            m_globalColorMap->Colors[m_background_color_index];
        bgColor = RGB(color.Red, color.Green, color.Blue);
    }

    for (int i = 0; i < m_width * m_height; i++)
    {
        compositeBuffer[i * 3] = bgColor.red();
        compositeBuffer[i * 3 + 1] = bgColor.green();
        compositeBuffer[i * 3 + 2] = bgColor.blue();
        compositeIndices[i] = m_background_color_index;
    }

    for (int i = 0; i < gif->ImageCount; i++)
    {
        SavedImage *savedImage = &gif->SavedImages[i];

        Image frameImage(m_width, m_height);
        Frame frame(frameImage);

        frame.x_offset = savedImage->ImageDesc.Left;
        frame.y_offset = savedImage->ImageDesc.Top;
        frame.is_interlaced = savedImage->ImageDesc.Interlace;
        frame.disposal_method = 0;
        frame.transparent_index = -1;
        frame.has_transparency = false;
        frame.delay_cs = 10;

        readExtensions(savedImage, frame);

        if (savedImage->ImageDesc.ColorMap)
        {
            ColorMapObject *newMap =
                GifMakeMapObject(savedImage->ImageDesc.ColorMap->ColorCount,
                                 savedImage->ImageDesc.ColorMap->Colors);
            if (!newMap)
            {
                int closeError = 0;
                DGifCloseFile(gif, &closeError);
                throw std::runtime_error("Failed to create frame color map");
            }
            frame.colorMap.reset(newMap);
        }

        ColorMapObject *colorMap =
            frame.colorMap ? frame.colorMap.get() : m_globalColorMap.get();
        if (!colorMap)
        {
            int closeError = 0;
            DGifCloseFile(gif, &closeError);
            throw std::runtime_error("No color map found for frame");
        }

        if (i > 0)
        {
            const Frame &prevFrame = m_frames.back();
            switch (prevFrame.disposal_method)
            {
                case DISPOSE_BACKGROUND:
                    for (int y = prevFrame.y_offset;
                         y < prevFrame.y_offset + prevFrame.image.height(); y++)
                    {
                        for (int x = prevFrame.x_offset;
                             x < prevFrame.x_offset + prevFrame.image.width();
                             x++)
                        {
                            if (x < m_width && y < m_height)
                            {
                                int pos = (y * m_width + x) * 3;
                                compositeBuffer[pos] = bgColor.red();
                                compositeBuffer[pos + 1] = bgColor.green();
                                compositeBuffer[pos + 2] = bgColor.blue();
                                compositeIndices[y * m_width + x] =
                                    m_background_color_index;
                            }
                        }
                    }
                    break;
                case DISPOSE_PREVIOUS:
                    // Not handling this case yet
                    break;
                default:
                    break;
            }
        }

        for (int y = 0; y < m_height; y++)
        {
            for (int x = 0; x < m_width; x++)
            {
                if (x >= frame.x_offset &&
                    x < frame.x_offset + savedImage->ImageDesc.Width &&
                    y >= frame.y_offset &&
                    y < frame.y_offset + savedImage->ImageDesc.Height)
                {
                    int src_x = x - frame.x_offset;
                    int src_y = y - frame.y_offset;
                    int idx =
                        savedImage
                            ->RasterBits[src_y * savedImage->ImageDesc.Width +
                                         src_x];

                    if (!frame.has_transparency ||
                        idx != frame.transparent_index)
                    {
                        GifColorType &color = colorMap->Colors[idx];
                        RGB pixelColor(color.Red, color.Green, color.Blue);
                        int pos = (y * m_width + x) * 3;
                        compositeBuffer[pos] = color.Red;
                        compositeBuffer[pos + 1] = color.Green;
                        compositeBuffer[pos + 2] = color.Blue;
                        compositeIndices[y * m_width + x] = idx;
                        frame.setPixel(x, y, pixelColor, idx);
                    }
                    else
                    {
                        int pos = (y * m_width + x) * 3;
                        RGB pixelColor(compositeBuffer[pos],
                                       compositeBuffer[pos + 1],
                                       compositeBuffer[pos + 2]);
                        frame.setPixel(x, y, pixelColor,
                                       compositeIndices[y * m_width + x]);
                    }
                }
                else
                {
                    int pos = (y * m_width + x) * 3;
                    RGB pixelColor(compositeBuffer[pos],
                                   compositeBuffer[pos + 1],
                                   compositeBuffer[pos + 2]);
                    frame.setPixel(x, y, pixelColor,
                                   compositeIndices[y * m_width + x]);
                }
            }
        }

        m_frames.push_back(std::move(frame));
    }

    DGifCloseFile(gif, &error);
}

GIF &GIF::operator=(const GIF &other)
{
    if (this != &other)
    {
        GIF temp(other);

        std::swap(m_width, temp.m_width);
        std::swap(m_height, temp.m_height);
        std::swap(m_frames, temp.m_frames);
        std::swap(m_globalColorMap, temp.m_globalColorMap);
        std::swap(m_loop_count, temp.m_loop_count);
        std::swap(m_background_color_index, temp.m_background_color_index);
        std::swap(m_has_global_color_map, temp.m_has_global_color_map);
    }
    return *this;
}

GIF::GIF(const GIF &other)
    : m_width(other.m_width)
    , m_height(other.m_height)
    , m_globalColorMap(nullptr, GifFreeMapObject)
    , m_loop_count(other.m_loop_count)
    , m_background_color_index(other.m_background_color_index)
    , m_has_global_color_map(other.m_has_global_color_map)
{
    if (other.m_globalColorMap)
    {
        ColorMapObject *newMap =
            GifMakeMapObject(other.m_globalColorMap->ColorCount, nullptr);
        if (!newMap)
        {
            throw std::runtime_error("Failed to create global color map");
        }

        for (int i = 0; i < other.m_globalColorMap->ColorCount; i++)
        {
            newMap->Colors[i] = other.m_globalColorMap->Colors[i];
        }
        newMap->ColorCount = other.m_globalColorMap->ColorCount;

        m_globalColorMap.reset(newMap);
    }

    m_frames.reserve(other.m_frames.size());
    for (const auto &frame : other.m_frames)
    {
        m_frames.push_back(frame);
    }
}

void GIF::readExtensions(SavedImage *saved_image, Frame &frame)
{
    for (int j = 0; j < saved_image->ExtensionBlockCount; j++)
    {
        ExtensionBlock *ext = &saved_image->ExtensionBlocks[j];
        if (ext->Function == GRAPHICS_EXT_FUNC_CODE && ext->ByteCount >= 4)
        {
            frame.disposal_method = (ext->Bytes[0] >> 2) & 0x07;
            frame.has_transparency = (ext->Bytes[0] & 0x01) == 1;
            frame.delay_cs = (ext->Bytes[2] << 8) | ext->Bytes[1];
            frame.transparent_index =
                frame.has_transparency ? ext->Bytes[3] : -1;
        }
    }
}

size_t GIF::frameCount() const
{
    return m_frames.size();
}

int GIF::width() const noexcept
{
    return m_width;
}
int GIF::height() const noexcept
{
    return m_height;
}

void GIF::addFrame(const Image &image, int delay_cs)
{
    if (image.width() != m_width || image.height() != m_height)
    {
        throw std::invalid_argument(
            "Frame dimensions must match GIF dimensions");
    }

    Frame frame(image);
    frame.delay_cs = delay_cs;
    m_frames.push_back(std::move(frame));
}

const GIF::Frame &GIF::getFrame(size_t index) const
{
    if (index >= m_frames.size())
    {
        throw std::out_of_range("Frame index out of bounds");
    }
    return m_frames[index];
}

GIF::Frame &GIF::getFrame(size_t index)
{
    if (index >= m_frames.size())
    {
        throw std::out_of_range("Frame index out of bounds");
    }
    return m_frames[index];
}

GifByteType GIF::Frame::findOrAddColor(const RGB &color)
{
    std::cout << "Attempting to add color RGB(" << (int)color.red() << ","
              << (int)color.green() << "," << (int)color.blue() << ")\n";

    if (!colorMap)
    {
        std::cout << "No colormap exists, creating new one\n";
        ColorMapObject *newMap = GifMakeMapObject(256, nullptr);
        if (!newMap)
        {
            throw std::runtime_error("Failed to create color map");
        }
        colorMap.reset(newMap);
        newMap->Colors[0].Red = color.red();
        newMap->Colors[0].Green = color.green();
        newMap->Colors[0].Blue = color.blue();
        newMap->ColorCount = 1;
        std::cout << "Added as first color at index 0\n";
        return 0;
    }

    std::cout << "Existing colormap found with " << colorMap->ColorCount
              << " colors\n";

    for (int i = 0; i < colorMap->ColorCount; i++)
    {
        if (colorMap->Colors[i].Red == color.red() &&
            colorMap->Colors[i].Green == color.green() &&
            colorMap->Colors[i].Blue == color.blue())
        {
            std::cout << "Found exact match at index " << i << "\n";
            return i;
        }
    }

    if (colorMap->ColorCount < 256)
    {
        int newIndex = colorMap->ColorCount;
        colorMap->Colors[newIndex].Red = color.red();
        colorMap->Colors[newIndex].Green = color.green();
        colorMap->Colors[newIndex].Blue = color.blue();
        colorMap->ColorCount++;
        std::cout << "Added new color at index " << newIndex << "\n";
        return newIndex;
    }

    int bestIndex = 0;
    int bestDiff = INT_MAX;

    for (int i = 0; i < colorMap->ColorCount; i++)
    {
        int redDiff = abs(colorMap->Colors[i].Red - color.red());
        int greenDiff = abs(colorMap->Colors[i].Green - color.green());
        int blueDiff = abs(colorMap->Colors[i].Blue - color.blue());
        int totalDiff = redDiff + greenDiff + blueDiff;

        if (totalDiff < bestDiff)
        {
            bestDiff = totalDiff;
            bestIndex = i;
        }
    }

    std::cout << "Palette full, using closest color at index " << bestIndex
              << " RGB(" << (int)colorMap->Colors[bestIndex].Red << ","
              << (int)colorMap->Colors[bestIndex].Green << ","
              << (int)colorMap->Colors[bestIndex].Blue << ")\n";

    return bestIndex;
}

void GIF::setPalette(size_t frameIndex, const std::vector<RGB> &palette)
{
    if (frameIndex >= m_frames.size())
    {
        throw std::out_of_range("Frame index out of bounds");
    }

    Frame &frame = m_frames[frameIndex];

    ColorMapObject *newMap = GifMakeMapObject(256, nullptr);
    if (!newMap)
    {
        throw std::runtime_error("Failed to create color map");
    }

    for (size_t i = 0; i < palette.size(); i++)
    {
        newMap->Colors[i].Red = palette[i].red();
        newMap->Colors[i].Green = palette[i].green();
        newMap->Colors[i].Blue = palette[i].blue();
    }

    RGB lastColor = palette.back();
    for (size_t i = palette.size(); i < 256; i++)
    {
        newMap->Colors[i].Red = lastColor.red();
        newMap->Colors[i].Green = lastColor.green();
        newMap->Colors[i].Blue = lastColor.blue();
    }

    newMap->ColorCount = 256;

    frame.colorMap.reset(newMap);
}

void GIF::setPixel(size_t frameIndex, int x, int y, const RGB &color)
{
    if (frameIndex >= m_frames.size())
    {
        throw std::out_of_range("Frame index out of bounds");
    }

    Frame &frame = m_frames[frameIndex];
    ColorMapObject *colorMap =
        frame.colorMap ? frame.colorMap.get() : m_globalColorMap.get();
    if (!colorMap)
    {
        throw std::runtime_error("No color map available");
    }

    for (int i = 0; i < colorMap->ColorCount; i++)
    {
        if (colorMap->Colors[i].Red == color.red() &&
            colorMap->Colors[i].Green == color.green() &&
            colorMap->Colors[i].Blue == color.blue())
        {
            frame.setPixel(x, y, color, i);
            return;
        }
    }

    throw std::runtime_error("Color not found in palette");
}
bool GIF::write(const std::string &filename) const
{
    return write(filename.c_str());
}

bool GIF::write(const char *filename) const
{
    int error = 0;
    GifFileType *gif = EGifOpenFileName(filename, false, &error);
    if (!gif)
        return false;

    if (EGifPutScreenDesc(gif, m_width, m_height, 8, m_background_color_index,
                          m_has_global_color_map ? m_globalColorMap.get()
                                                 : nullptr) != GIF_OK)
    {
        EGifCloseFile(gif, &error);
        return false;
    }

    unsigned char nsle[3] = {1, 0, 0};
    if (EGifPutExtensionLeader(gif, APPLICATION_EXT_FUNC_CODE) != GIF_OK ||
        EGifPutExtensionBlock(gif, 11, "NETSCAPE2.0") != GIF_OK ||
        EGifPutExtensionBlock(gif, 3, nsle) != GIF_OK ||
        EGifPutExtensionTrailer(gif) != GIF_OK)
    {
        EGifCloseFile(gif, &error);
        return false;
    }

    std::vector<GifByteType> currentIndices(m_width * m_height,
                                            m_background_color_index);

    for (const auto &frame : m_frames)
    {
        std::vector<GifByteType> nextIndices = currentIndices;

        int minX = m_width, minY = m_height, maxX = 0, maxY = 0;
        bool hasChanges = false;

        for (int y = 0; y < m_height; y++)
        {
            for (int x = 0; x < m_width; x++)
            {
                GifByteType newIndex = frame.indices[y * m_width + x];
                if (newIndex != currentIndices[y * m_width + x])
                {
                    hasChanges = true;
                    minX = std::min(minX, x);
                    minY = std::min(minY, y);
                    maxX = std::max(maxX, x);
                    maxY = std::max(maxY, y);
                    nextIndices[y * m_width + x] = newIndex;
                }
            }
        }

        if (!hasChanges)
        {
            minX = minY = 0;
            maxX = maxY = 1;
        }

        minX = std::max(0, minX - 1);
        minY = std::max(0, minY - 1);
        maxX = std::min(m_width - 1, maxX + 1);
        maxY = std::min(m_height - 1, maxY + 1);

        int frameWidth = maxX - minX + 1;
        int frameHeight = maxY - minY + 1;

        unsigned char extension[4];
        unsigned char packed = frame.disposal_method << 2;
        if (frame.has_transparency)
        {
            packed |= 0x01;
        }

        extension[0] = packed;
        extension[1] = frame.delay_cs & 0xFF;
        extension[2] = (frame.delay_cs >> 8) & 0xFF;
        extension[3] = frame.has_transparency ? frame.transparent_index : 0;

        if (EGifPutExtension(gif, GRAPHICS_EXT_FUNC_CODE, sizeof(extension),
                             extension) != GIF_OK)
        {
            EGifCloseFile(gif, &error);
            return false;
        }
        if (EGifPutImageDesc(gif, minX, minY, frameWidth, frameHeight,
                             frame.is_interlaced,
                             frame.colorMap.get()) != GIF_OK)
        {
            EGifCloseFile(gif, &error);
            return false;
        }

        std::vector<GifByteType> rasterBits(frameWidth);
        for (int y = 0; y < frameHeight; y++)
        {
            for (int x = 0; x < frameWidth; x++)
            {
                rasterBits[x] = nextIndices[(y + minY) * m_width + (x + minX)];
            }
            if (EGifPutLine(gif, rasterBits.data(), frameWidth) != GIF_OK)
            {
                EGifCloseFile(gif, &error);
                return false;
            }
        }

        if (frame.disposal_method == DISPOSE_DO_NOT)
        {
            currentIndices = nextIndices;
        }
        else if (frame.disposal_method == DISPOSE_BACKGROUND)
        {
            for (int y = minY; y <= maxY; y++)
            {
                for (int x = minX; x <= maxX; x++)
                {
                    currentIndices[y * m_width + x] = m_background_color_index;
                }
            }
        }
    }

    return EGifCloseFile(gif, &error) == GIF_OK;
}

std::vector<unsigned char> GIF::write() const
{
    int error = 0;
    GifFileType *gif = EGifOpen(
        nullptr,
        [](GifFileType *gif, const GifByteType *data, int len) -> int {
            auto vec = static_cast<std::vector<unsigned char> *>(gif->UserData);
            vec->insert(vec->end(), data, data + len);
            return len;
        },
        &error);

    if (!gif)
    {
        return {};
    }

    std::vector<unsigned char> result;
    gif->UserData = &result;

    if (EGifPutScreenDesc(gif, m_width, m_height, 8, m_background_color_index,
                          m_has_global_color_map ? m_globalColorMap.get()
                                                 : nullptr) != GIF_OK)
    {
        EGifCloseFile(gif, &error);
        return {};
    }

    unsigned char nsle[3] = {1, 0, 0};
    if (EGifPutExtensionLeader(gif, APPLICATION_EXT_FUNC_CODE) != GIF_OK ||
        EGifPutExtensionBlock(gif, 11, "NETSCAPE2.0") != GIF_OK ||
        EGifPutExtensionBlock(gif, 3, nsle) != GIF_OK ||
        EGifPutExtensionTrailer(gif) != GIF_OK)
    {
        EGifCloseFile(gif, &error);
        return {};
    }

    std::vector<GifByteType> currentIndices(m_width * m_height,
                                            m_background_color_index);

    for (const auto &frame : m_frames)
    {
        std::vector<GifByteType> nextIndices = currentIndices;

        int minX = m_width, minY = m_height, maxX = 0, maxY = 0;
        bool hasChanges = false;

        for (int y = 0; y < m_height; ++y)
        {
            for (int x = 0; x < m_width; ++x)
            {
                GifByteType newIndex = frame.indices[y * m_width + x];
                if (newIndex != currentIndices[y * m_width + x])
                {
                    hasChanges = true;
                    minX = std::min(minX, x);
                    minY = std::min(minY, y);
                    maxX = std::max(maxX, x);
                    maxY = std::max(maxY, y);
                    nextIndices[y * m_width + x] = newIndex;
                }
            }
        }

        if (!hasChanges)
        {
            minX = minY = 0;
            maxX = maxY = 1;
        }

        minX = std::max(0, minX - 1);
        minY = std::max(0, minY - 1);
        maxX = std::min(m_width - 1, maxX + 1);
        maxY = std::min(m_height - 1, maxY + 1);

        int frameWidth = maxX - minX + 1;
        int frameHeight = maxY - minY + 1;

        unsigned char extension[4];
        unsigned char packed = frame.disposal_method << 2;
        if (frame.has_transparency)
        {
            packed |= 0x01;
        }

        extension[0] = packed;
        extension[1] = frame.delay_cs & 0xFF;
        extension[2] = (frame.delay_cs >> 8) & 0xFF;
        extension[3] = frame.has_transparency ? frame.transparent_index : 0;

        if (EGifPutExtension(gif, GRAPHICS_EXT_FUNC_CODE, sizeof(extension),
                             extension) != GIF_OK)
        {
            EGifCloseFile(gif, &error);
            return {};
        }

        if (EGifPutImageDesc(gif, minX, minY, frameWidth, frameHeight,
                             frame.is_interlaced,
                             frame.colorMap.get()) != GIF_OK)
        {
            EGifCloseFile(gif, &error);
            return {};
        }

        std::vector<GifByteType> rasterBits(frameWidth);
        for (int y = 0; y < frameHeight; y++)
        {
            for (int x = 0; x < frameWidth; x++)
            {
                rasterBits[x] = nextIndices[(y + minY) * m_width + (x + minX)];
            }
            if (EGifPutLine(gif, rasterBits.data(), frameWidth) != GIF_OK)
            {
                EGifCloseFile(gif, &error);
                return {};
            }
        }

        if (frame.disposal_method == DISPOSE_DO_NOT)
        {
            currentIndices = nextIndices;
        }
        else if (frame.disposal_method == DISPOSE_BACKGROUND)
        {
            for (int y = minY; y <= maxY; y++)
            {
                for (int x = minX; x <= maxX; x++)
                {
                    currentIndices[y * m_width + x] = m_background_color_index;
                }
            }
        }
    }

    if (EGifCloseFile(gif, &error) != GIF_OK)
    {
        return {};
    }

    return result;
}
