FROM debian:11-slim
RUN echo "root:adminpassword" | chpasswd
RUN echo "deb http://deb.debian.org/debian bullseye-backports main" \
    > /etc/apt/sources.list.d/bullseye-backports.list

RUN apt-get update && \
    apt-get install -y -t bullseye-backports libcurl4 && \
    apt-get install -y \
    cups \
    cups-client \
    cups-bsd \
    cups-filters \
    cups-ipp-utils \
    cups-pdf \
    printer-driver-all \
    samba \
    samba-common-bin \
    smbclient \
    cifs-utils \
    python3 \
    python3-cups \
    # wsdd \
    && rm -rf /var/lib/apt/lists/*


# Copy your Direct Print app into the container
COPY direct_print/DirectPrintClient-4.27.17-debian_11-x86_64/ /opt/directprint/

COPY smb.conf /etc/samba/smb.conf


RUN ldconfig
RUN chmod +x /opt/directprint/DirectPrintClient
RUN chmod +x /opt/directprint/init.sh

ENV PYTHONUNBUFFERED=1

# Expose ports if your app listens on any (optional)
EXPOSE 631 139 445 8888

# RUN adduser --disabled-password --gecos "" officeprinters && \
# # RUN adduser --gecos "" officeprinters && \
#     (echo "printers"; echo "printers") | smbpasswd -a officeprinters -s
RUN printf "printers\nprinters\n" | smbpasswd -s -a root



ENTRYPOINT ["/bin/sh", "-c", "cupsd -f & smbd && nmbd && /opt/directprint/DirectPrintClient --headless --shutdown-on-sigint --web-interface --remove-scales-support"]

