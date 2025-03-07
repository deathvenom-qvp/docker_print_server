# External Dependences

You will need the following available at the following locations:

/usr/bin/lp
/usr/bin/lpoptions
/usr/bin/lpstat
/usr/bin/ipptool
/usr/bin/lpr

In addition to this you will also need "cupsctl" available somewhere on your system path.

All the above are available on linux within the CUPS project and its related packages
(https://www.cups.org/).

The exact way to install these will vary by distribution. For Debian-based distros
the following packages contain everything and they're all in the standard repos:

cups
cups-client
cups-bsd
cups-ipp-utils
libcups2-dev

# Cups-specific setup

We recommend that you add/remove/configure printers via the CUPS web interface.
By default this is at http://localhost:631 and is only listening locally. If you want
it to be accessible remotely, run the following command:

sudo cupsctl --remote-admin

(If you access a computer's CUPS server remotely it may insist that you use https instead
of http and this will result in a security warning from your browser.  It is safe to
dismiss the warning and continue.)

The client software will also need a certain level of CUPS access priviliges for
some functionality, e.g., creating printer subscriptions to monitor progress for its
PrintJobs as they pass through your system.  This means that the OS user under which you
run the client software needs permissions which aren't typically granted to a user by
default.

The exact way to enable these permissions varies from distribution to distribution. On
Debian you do this by adding the user which will run the client software to the
"lpadmin" group:

sudo usermod -aG lpadmin <username>

On other distros you may need to add the "sys" and "lp" groups instead.

Further information is available here:
https://ro-che.info/articles/2016-07-08-debugging-cups-forbidden-error

You can test to see if an OS user has the appropriate permissions by pointing a browser
at the CUPS server, e.g. https://192.168.88.252:631/admin/, logging in as the user in
question and trying to add a printer. If you get a "forbidden" error then the user
doesn't have sufficient permissions.


# USB Weighing Scales with the client.

This client accesses USB devices via Linux's "hidraw" subsystem. On the Linux distros
PrintNode has tested the Client on, the default permissions for hidraw devices are 0x600,
i.e. access to USB HID scales is for root users only.

You can check the permissions currently assigned to HID devices on a system as follows:

ls -al /dev/hid*

Access to USB scales or other hidraw devices as an unprivileged user is controlled with
udev rules which can whitelist some or all devices.

The included executable "udev-rule-generator" can generate udev rules specifically
for your system and connected devices. In addition to this if you run "udev-rule-generator"
as the root user it will also write the rules file to the correct location and apply
the changes. "udev-rule-generator" is safe to run multiple times. You should run 
"udev-rule-generator" the first time you plug a new USB scale into a computer.

Using "udev-rule-generator" is the easiest way to create and manage udev rules.

sudo ./udev-rule-generator

If you choose to create udev rules manually. The following links may be helpful.

https://github.com/signal11/hidapi/blob/master/udev/99-hid.rules
http://www.reactivated.net/writing_udev_rules.html

To whitelist all USB hidraw devices for all users, add the following text to
/etc/udev/rules.d/10-scales.rules:

KERNEL=="hidraw*", SUBSYSTEM=="hidraw", MODE="0666"


# Running the client

Assuming that:

1. you can access the cups web interface and don't get a forbidden error when trying
to add a printer; and
2. lp, lpoptions, lpstat, ipptool all available in /usr/bin
3. udev rules for any usb scales have been applied and loaded

you are ready to run the client. From the directory created when you extract the .tgz
file, you can run it as follows:

./DirectPrintClient

The client software supports several command-line options. Run

./DirectPrintClient --help

for details. It can also read these options from a configuration file. See
./sample_config.conf for a sample configuration file.

On Linux the client will look for it's config file at

/etc/DirectPrintClient/config.conf

but you can also manually specify a config file location with the command line
argument

--config-file="/path/to/config/file".

Some common use cases are as follows:

    1. Just run the client:

        ./DirectPrintClient

    2. Run the client on a headless device, e.g. a Rasberry PI.

        ./DirectPrintClient --headless --web-interface --web-interface-shutdown --shutdown-on-sigint

    3. Checking a config file for errors

        ./DirectPrintClient --config-file="/path/to/my/config/file.conf" --check


# Return codes.

The client returns zero after an orderly, error-free shutdown and nonzero otherwise.
The possible return codes and their meanings are as follows:

    0: orderly shutdown, no errors.
    1: Unknown error.
    64: Invalid command line argument.
    70: Error starting application. This is usually happens if the application is already running.
    71: File system error creating/accessing/writing client settings or logs.
    74: Settings directory does not exist.
    77: File system permission error creating/accessing/writing client settings or logs.
    78: Configuration file error.

A human readable message containing more details will be available on stdout.


# Using the init script to run the client as a system daemon

The file ./init.sh is a SysV-style init script for the client. To use it:

1. Copy it to /etc/init.d/DirectPrintClient:

cp init.sh /etc/init.d/DirectPrintClient

2. OPTIONAL: edit the script to set the "user" variable to the name of a user
which the client should run as.  Leaving it as an empty string runs the client
as root.

3. Update the init system:

update-rc.d DirectPrintClient defaults

4. On systemd-powered distros, let systemd know about it:

systemctl daemon-reload

It should now be possible to start and stop the client with

/etc/init.d/DirectPrintClient start

and

/etc/init.d/DirectPrintClient stop

or, on distros which use upstart,

service DirectPrintClient start

and

service DirectPrintClient stop

To determine whether the client is running, look for it in the process list, e.g.:

ps ax | grep DirectPrintClient

# Logging

The client logs a limited amount of information to /var/log/syslog and stdout.


# Known bugs and issues

1.  If the OS user under which the client runs doesn't have full CUPS permissions
    (see "CUPS-specific setup" above) performance and functionality will be reduced.