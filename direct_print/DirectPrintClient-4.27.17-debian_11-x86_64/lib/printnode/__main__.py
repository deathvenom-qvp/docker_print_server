import sys
from enum import Enum

from printnode.main import main

if __name__ == '__main__':
    exit_code = main(boot_sigint=None)
    if isinstance(exit_code, Enum):
        exit_code = exit_code.value
    sys.exit(exit_code)
