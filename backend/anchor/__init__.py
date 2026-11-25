"""Anchor backend package.

`create_app` is imported lazily so the pure services in `anchor.services`
can be imported (and tested) without Flask extensions installed.
"""


def create_app(*args, **kwargs):
    from .app import create_app as _create_app

    return _create_app(*args, **kwargs)
