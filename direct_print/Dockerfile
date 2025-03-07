FROM debian:11-slim

RUN echo "deb http://deb.debian.org/debian bullseye-backports main" \
    > /etc/apt/sources.list.d/bullseye-backports.list

RUN apt-get update && \
    apt-get install -y -t bullseye-backports libcurl4

# Copy your Direct Print app into the container
COPY DirectPrintClient-4.27.17-debian_11-x86_64/ /opt/directprint/

RUN ldconfig

RUN chmod +x /opt/directprint/DirectPrintClient
RUN chmod +x /opt/directprint/init.sh

# Expose ports if your app listens on any (optional)
# EXPOSE 1234

# Set the app as the container's main process
# CMD ["/opt/directprint/init.sh"]
CMD /opt/directprint/DirectPrintClient --headless --shutdown-on-sigint --web-interface --remove-scales-support

