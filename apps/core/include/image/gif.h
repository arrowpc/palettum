#pragma once

#include <gif_lib.h>
#include "image/image.h"

class GIF
{
public:
    struct Frame {
        Image image;
        std::vector<GifByteType> indices;
        std::unique_ptr<ColorMapObject, void (*)(ColorMapObject *)> colorMap;
        int delay_cs;

        int disposal_method{};
        int transparent_index{};
        bool has_transparency{};
        int y_offset{};
        int x_offset{};
        bool is_interlaced{};

        explicit Frame(const Image &img);
        Frame(const Frame &other);
        Frame(Frame &&) noexcept = default;

        void setPixel(int x, int y, const RGBA &color, GifByteType index);
        void setPixel(int x, int y, const RGB &color, GifByteType index);
        [[nodiscard]] GifByteType getIndex(int x, int y) const;
    };

    explicit GIF(const std::string &filename);
    explicit GIF(const char *filename);
    explicit GIF(int width, int height);
    explicit GIF(const unsigned char *buffer, int length);
    ~GIF() = default;

    GIF &operator=(const GIF &other);
    GIF(const GIF &other);
    GIF(GIF &&) noexcept = default;

    void setPalette(size_t frameIndex, const std::vector<RGB> &palette);
    void setPixel(size_t frameIndex, int x, int y, const RGBA &color);
    void setPixel(size_t frameIndex, int x, int y, const RGB &color);
    [[nodiscard]] size_t frameCount() const;

    void addFrame(const Image &image, int delay_cs = 10);
    [[nodiscard]] const Frame &getFrame(size_t index) const;
    Frame &getFrame(size_t index);

    bool write(const char *filename) const;
    [[nodiscard]] bool write(const std::string &filename) const;
    std::vector<unsigned char> write() const;

    bool resize(int width, int height);

    [[nodiscard]] int width() const noexcept;
    [[nodiscard]] int height() const noexcept;

private:
    std::vector<Frame> m_frames;
    std::unique_ptr<ColorMapObject, void (*)(ColorMapObject *)>
        m_globalColorMap;
    int m_width;
    int m_height;

    int m_loop_count;  // 0 = infinite, -1 = no loop, else specific count
    int m_background_color_index;
    bool m_has_global_color_map;

    static void readExtensions(SavedImage *saved_image, Frame &frame);
    static int readFromMemory(GifFileType *gif, GifByteType *buf, int size);
};

struct MemoryBuffer {
    const unsigned char *data;
    int length;
    int position;
};
