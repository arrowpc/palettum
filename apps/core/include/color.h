#ifndef COLOR_H
#define COLOR_H

#pragma push_macro("min")
#pragma push_macro("max")

#undef min
#undef max

#include <simd_utils.h>

#pragma pop_macro("min")
#pragma pop_macro("max")

#include <algorithm>
#include <iostream>
#include <optional>
#include <vector>

#ifndef M_PI
#    define M_PI 3.14159265358979323846264338327950288
#endif

const float pow25_7 = 6103515625.0f;
float const RAD_TO_DEG = 180.0f / M_PI;
float const HALF_DEG_TO_RAD = M_PI / 360.0f;
float const DEG_TO_RAD = M_PI / 180.0f;

class RGB;
class Lab;

struct XYZ {
    float X{0}, Y{0}, Z{0};

    static constexpr float WHITE_X = 95.047f;
    static constexpr float WHITE_Y = 100.000;
    static constexpr float WHITE_Z = 108.883;
    static constexpr float EPSILON = 0.008856;
    static constexpr float KAPPA = 903.3;
};

class Lab
{
public:
    explicit Lab(float L = 0, float a = 0, float b = 0) noexcept;
    [[nodiscard]] RGB toRGB() const noexcept;
    [[nodiscard]] float L() const noexcept;
    [[nodiscard]] float a() const noexcept;
    [[nodiscard]] float b() const noexcept;
    static void deltaE(const Lab &ref, const Lab *comp, float *results,
                       int len);
    [[nodiscard]] float deltaE(const Lab &other) const noexcept;
    friend std::ostream &operator<<(std::ostream &os, const Lab &lab);

private:
    float m_L, m_a, m_b;
};

class RGB
{
public:
    explicit RGB(unsigned char r = 0, unsigned char g = 0,
                 unsigned char b = 0) noexcept;
    [[nodiscard]] Lab toLab() const noexcept;
    RGB(std::initializer_list<unsigned char> il) noexcept
    {
        auto it = il.begin();
        m_r = it != il.end() ? *it++ : 0;
        m_g = it != il.end() ? *it++ : 0;
        m_b = it != il.end() ? *it : 0;
    }
    bool operator==(const RGB &rhs) const noexcept;
    [[nodiscard]] constexpr unsigned char red() const noexcept
    {
        return m_r;
    }
    [[nodiscard]] constexpr unsigned char green() const noexcept
    {
        return m_g;
    }
    [[nodiscard]] constexpr unsigned char blue() const noexcept
    {
        return m_b;
    }
    bool operator!=(const RGB &rhs) const noexcept;
    friend std::ostream &operator<<(std::ostream &os, const RGB &RGB);

private:
    unsigned char m_r, m_g, m_b;
    [[nodiscard]] static float pivotXYZ(float n) noexcept;
};

class RGBCache
{
private:
    static constexpr int R_SHIFT = 16;
    static constexpr int G_SHIFT = 8;

    struct Entry {
        RGB val;
        bool init;

        Entry()
            : val{}
            , init{false}
        {
        }
    };

    std::vector<Entry> m_entries;

public:
    RGBCache()
        : m_entries(1 << 24)
    {
    }

    void set(const RGB &key, const RGB &val) noexcept
    {
        const size_t idx = makeIndex(key);
        m_entries[idx].val = val;
        m_entries[idx].init = true;
    }

    [[nodiscard]] std::optional<RGB> get(const RGB &key) const noexcept
    {
        const size_t idx = makeIndex(key);
        return m_entries[idx].init ? std::optional{m_entries[idx].val}
                                   : std::nullopt;
    }

private:
    [[nodiscard]] static constexpr size_t makeIndex(const RGB &rgb) noexcept
    {
        return (rgb.red() << R_SHIFT) | (rgb.green() << G_SHIFT) | rgb.blue();
    }
};

#endif  //COLOR_H
