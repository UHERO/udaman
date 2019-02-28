class ExportSeries < ApplicationRecord
  belongs_to :export
  belongs_to :series
end