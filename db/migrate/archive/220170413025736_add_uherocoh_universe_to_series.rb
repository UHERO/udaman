class AddUherocohUniverseToSeries < ActiveRecord::Migration[5.2]
  def self.up
    change_column :series, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH','UHEROCOH')), null: false, default: 'UHERO'
  end
  def self.down
    change_column :series, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
  end
end
