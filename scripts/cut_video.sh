#!/bin/bash

# ============================================
# 영상 구간 다운로드 스크립트 (Universal)
# - 자동 OS 감지
# - 자동 패키지 설치
# - 비개발자 친화적
# ============================================

# ========== 설정 (여기만 수정) ==========
URL="https://chzzk.naver.com/video/11569695"
START="3:05:24"
END="3:10:21"
OUTPUT="테스트"
# =======================================

set -e  # 오류 발생 시 중단

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# OS 감지
detect_os() {
    case "$(uname -s)" in
        Darwin*)
            OS="macos"
            log_info "운영체제: macOS"
            ;;
        Linux*)
            OS="linux"
            log_info "운영체제: Linux"
            ;;
        CYGWIN*|MINGW*|MSYS*)
            OS="windows"
            log_info "운영체제: Windows"
            ;;
        *)
            log_error "지원하지 않는 운영체제입니다."
            exit 1
            ;;
    esac
}

# 패키지 관리자 확인 (macOS)
check_homebrew() {
    if ! command -v brew &> /dev/null; then
        log_warning "Homebrew가 설치되어 있지 않습니다."
        read -p "Homebrew를 설치하시겠습니까? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Homebrew 설치 중..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            log_success "Homebrew 설치 완료"
        else
            log_error "Homebrew가 필요합니다. 설치를 취소합니다."
            exit 1
        fi
    else
        log_success "Homebrew 확인됨"
    fi
}

# 패키지 관리자 확인 (Linux)
check_linux_package_manager() {
    if command -v apt &> /dev/null; then
        PKG_MANAGER="apt"
        INSTALL_CMD="sudo apt update && sudo apt install -y"
    elif command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
        INSTALL_CMD="sudo dnf install -y"
    elif command -v pacman &> /dev/null; then
        PKG_MANAGER="pacman"
        INSTALL_CMD="sudo pacman -S --noconfirm"
    elif command -v zypper &> /dev/null; then
        PKG_MANAGER="zypper"
        INSTALL_CMD="sudo zypper install -y"
    else
        log_error "지원하는 패키지 관리자를 찾을 수 없습니다."
        exit 1
    fi
    log_success "패키지 관리자: $PKG_MANAGER"
}

# 패키지 관리자 확인 (Windows)
check_windows_package_manager() {
    if command -v choco &> /dev/null; then
        PKG_MANAGER="choco"
        INSTALL_CMD="choco install -y"
        log_success "패키지 관리자: Chocolatey"
    elif command -v scoop &> /dev/null; then
        PKG_MANAGER="scoop"
        INSTALL_CMD="scoop install"
        log_success "패키지 관리자: Scoop"
    elif command -v winget &> /dev/null; then
        PKG_MANAGER="winget"
        INSTALL_CMD="winget install -e --id"
        log_success "패키지 관리자: Winget"
    else
        log_error "패키지 관리자(Chocolatey/Scoop/Winget)가 필요합니다."
        log_info "Chocolatey 설치: https://chocolatey.org/install"
        log_info "Scoop 설치: https://scoop.sh"
        exit 1
    fi
}

# 패키지 설치 (macOS)
install_package_macos() {
    local package=$1
    if ! command -v $package &> /dev/null; then
        log_warning "$package가 설치되어 있지 않습니다."
        log_info "$package 설치 중..."
        brew install $package
        log_success "$package 설치 완료"
    else
        log_success "$package 확인됨 ($(command -v $package))"
    fi
}

# 패키지 설치 (Linux)
install_package_linux() {
    local package=$1
    if ! command -v $package &> /dev/null; then
        log_warning "$package가 설치되어 있지 않습니다."
        log_info "$package 설치 중..."
        eval "$INSTALL_CMD $package"
        log_success "$package 설치 완료"
    else
        log_success "$package 확인됨 ($(command -v $package))"
    fi
}

# 패키지 설치 (Windows)
install_package_windows() {
    local package=$1
    local win_package=$2  # Windows용 패키지 이름

    if ! command -v $package &> /dev/null; then
        log_warning "$package가 설치되어 있지 않습니다."
        log_info "$package 설치 중..."

        if [ "$PKG_MANAGER" = "winget" ]; then
            eval "$INSTALL_CMD $win_package"
        else
            eval "$INSTALL_CMD $package"
        fi

        log_success "$package 설치 완료"
    else
        log_success "$package 확인됨 ($(command -v $package))"
    fi
}

# 의존성 확인 및 설치
check_dependencies() {
    log_info "=========================================="
    log_info "의존성 확인 중..."
    log_info "=========================================="

    if [ "$OS" = "macos" ]; then
        check_homebrew
        install_package_macos "streamlink"
        install_package_macos "ffmpeg"

    elif [ "$OS" = "linux" ]; then
        check_linux_package_manager
        install_package_linux "streamlink"
        install_package_linux "ffmpeg"

    elif [ "$OS" = "windows" ]; then
        check_windows_package_manager
        install_package_windows "streamlink" "Streamlink.Streamlink"
        install_package_windows "ffmpeg" "Gyan.FFmpeg"
    fi

    log_success "모든 의존성 확인 완료!"
    echo ""
}

# 시간 계산
calculate_duration() {
    OUTPUT="${OUTPUT%.mp4}.mp4"
    START_SEC=$(($(echo $START | awk -F: '{print $1*3600+$2*60+$3}')))
    END_SEC=$(($(echo $END | awk -F: '{print $1*3600+$2*60+$3}')))
    DUR_SEC=$((END_SEC - START_SEC))

    if [ $DUR_SEC -le 0 ]; then
        log_error "종료시간이 시작시간보다 빠르거나 같습니다."
        exit 1
    fi

    DUR=$(printf "%02d:%02d:%02d" $((DUR_SEC/3600)) $(((DUR_SEC%3600)/60)) $((DUR_SEC%60)))
}

# 다운로드 실행
download_video() {
    log_info "=========================================="
    log_info "다운로드 정보"
    log_info "=========================================="
    log_info "URL: $URL"
    log_info "구간: $START ~ $END (${DUR})"
    log_info "출력: $OUTPUT"
    log_info "=========================================="
    echo ""

    log_info "구간 다운로드 시작..."
    if streamlink --hls-start-offset "$START" --stream-segmented-duration "$DUR" "$URL" best -o "temp.mp4"; then
        log_success "다운로드 완료"
    else
        log_error "다운로드 실패"
        exit 1
    fi

    echo ""
    log_info "타임스탬프 리셋 중..."
    rm -f "$OUTPUT"  # 기존 파일 삭제 (있다면)
    if ffmpeg -i "temp.mp4" -c copy -avoid_negative_ts make_zero -fflags +genpts "$OUTPUT" -loglevel error; then
        log_success "타임스탬프 리셋 완료"
    else
        log_error "타임스탬프 리셋 실패"
        rm -f "temp.mp4"
        exit 1
    fi

    rm -f "temp.mp4"

    echo ""
    log_success "=========================================="
    log_success "완료: $OUTPUT (재생시간: $DUR)"
    log_success "=========================================="
}

# 메인 실행
main() {
    echo ""
    log_info "=========================================="
    log_info "영상 구간 다운로드 스크립트"
    log_info "=========================================="
    echo ""

    detect_os
    check_dependencies
    calculate_duration
    download_video
}

# 스크립트 실행
main
