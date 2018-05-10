require 'spec_helper'

describe DataPoint do
  before(:each) do
    @s = Series.create
    @ds1_80 = DataSource.create priority: 80
    @ds2_80 = DataSource.create priority: 80
    @ds2_70 = DataSource.create priority: 70
    @dp = DataPoint.create(series_id: @s.id,
                           date: '2011-03-01',
                           value: 100.0,
                           data_source_id: @ds1_80.id,
                           current: true)
    ## Shove anything other than zero into the unused :id column as a way
    ## to check dp object identity that doesn't depend on the clock
    @arbitrary_id = 999
    @dp.write_attribute :id, @arbitrary_id
  end

  it 'should NOT change data_point if value and source_id are unchanged' do
    newdp = @dp.upd(100, @ds1_80)
    cur_dps = @s.current_data_points
    expect(newdp).to eq(nil), 'thing returned is not nil'
    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(cur_dps.first.read_attribute :id).to eq(@arbitrary_id), 'current dp is a different from original'
    expect(@dp.current).to eq(true), 'old data point no longer current'
    expect(@dp.value_equal_to? 100.0).to eq(true), 'old data point value has changed in place'
    expect(@dp.data_source_id).to eq(@ds1_80.id), 'old data point source has changed in place'
  end

  it 'should update a data_points data source if source is different, source.priority not < current' do
    newdp = @dp.upd(100, @ds2_80)
    cur_dps = @s.current_data_points

    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(newdp.class).to eq(DataPoint), 'thing returned is not a DataPoint'
    expect(newdp.read_attribute :id).not_to eq(@arbitrary_id), 'a new dp was not created'
    expect(newdp.current).to eq(true), 'new dp not set to current'
    expect(@dp.current).to eq(false), 'old dp still current'
    expect(newdp.value_equal_to? dp.value).to eq(true), 'dp values are not equal'
    expect(newdp.data_source_id).to eq(@ds2_80.id), 'new dp does not have new source'
  end

  it 'should NOT update a data_points data source if source is different, source.priority < current' do
    newdp = @dp.upd(100, @ds2_70)
    cur_dps = @s.current_data_points

    expect(newdp).to eq(nil), 'thing returned is not nil'
    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(cur_dps.first.read_attribute :id).to eq(@arbitrary_id), 'current dp is different from original'
    expect(@dp.current).to eq(true), 'old data point no longer current'
    expect(@dp.value_equal_to? 100.0).to eq(true), 'old data point value has changed in place'
    expect(@dp.data_source_id).to eq(@ds1_80.id), 'old data point source has changed in place'
  end

  it 'should update a data_points value if value is different, source.priority not < current' do
    newdp = @dp.upd(200, @ds2_80)
    cur_dps = @s.current_data_points

    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(newdp.class).to eq(DataPoint), 'thing returned is not a DataPoint'
    expect(newdp.read_attribute :id).not_to eq(@arbitrary_id), 'a new dp was not created'
    expect(newdp.current).to eq(true), 'new dp not set to current'
    expect(@dp.current).to eq(false), 'old dp still set to current'
    expect(newdp.value_equal_to? @dp.value).to eq(false), 'new and old dp values are equal'
    expect(newdp.data_source_id).to eq(@ds2_80.id), 'new dp doesnt have the new source'
  end

  it 'should NOT update a data_points value if value is different, source.priority < current' do
    newdp = @dp.upd(200, @ds2_70)
    cur_dps = @s.current_data_points

    expect(newdp).to eq(nil), 'thing returned is not nil'
    expect(cur_dps.count).to eq(1), 'not exactly one current dp'
    expect(cur_dps.first.read_attribute :id).to eq(@arbitrary_id), 'current dp is different from original'
    expect(@dp.current).to eq(true), 'old data point no longer current'
    expect(@dp.value_equal_to? 100.0).to eq(true), 'old data point value has changed in place'
    expect(@dp.data_source_id).to eq(@ds1_80.id), 'old data point source has changed in place'
  end

  #########################################################################################################
  it 'should restore previously current data point, when updated to its same properties' do
    dp1 = @dp.upd(200, @ds2_80)
    ## dp1 should now be current, as tested above
    newdp = dp1.upd(@dp.value, @dp.data_source_id)
    ## now @dp should be restored to current, and newdp should == @dp

    expect(@s.current_data_points.count).to eq(1), 'not exactly one current dp'
    expect(@s.data_points.count).to eq(2), 'not exactly two dps for this series'
    expect(newdp.class).to eq(DataPoint), 'thing returned is not a DataPoint'
    expect(newdp.read_attribute :id).to eq(@arbitrary_id), 'a new dp was created rather than an old one restored'
    expect(newdp.current).to eq(true), 'new dp not set to current'
    expect(dp1.current).to eq(false), 'previous current dp still set to current'
    expect(newdp.value_equal_to? @dp.value).to eq(true), 'new and old dp values are not equal'
    expect(newdp.data_source_id).to eq(@dp.data_source_id), 'new dp doesnt have the correct source'
  end

  it 'should restore correct dp next-in-line by updated_at time when current is deleted' do
    dp = @dp.upd(200, @ds1_80)
    sleep 1
    dp = dp.upd(400, @ds1_80)
    sleep 1 ## make sure updated_at changes
    dp = dp.upd(300, @ds1_80)
    sleep 1
    dp500 = dp.upd(500, @ds1_80)
    cdp = @s.current_data_points
    expect(dp500.current).to eq(true), 'new dp not set to current'
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.value_equal_to? 500).to eq(true), 'current dp is not dp=500'
    expect(@s.data_points.count).to eq(5), 'not exactly five dps in this series'

    dp500.delete
    cdp = @s.current_data_points

    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.value_equal_to? 300).to eq(true), 'correct dp=300 not restored to current'
    expect(@s.data_points.count).to eq(4), 'not exactly four dps for this series'
  end

  it 'should NOT change current dp when non-current dp is deleted' do
    dp = @dp.upd(200, @ds1_80)
    sleep 1
    dp400 = dp.upd(400, @ds1_80)
    sleep 1 ## make sure updated_at changes
    dp = dp400.upd(300, @ds1_80)
    sleep 1
    dp = dp.upd(500, @ds1_80)
    cdp = @s.current_data_points
    expect(dp.current).to eq(true), 'new dp not set to current'
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.value_equal_to? 500).to eq(true), 'correct dp=500 not restored to current'
    expect(@s.data_points.count).to eq(5), 'not exactly five dps in this series'

    dp400.delete
    cdp = @s.current_data_points

    expect(dp.current).to eq(true), 'original current dp no longer set to current'
    expect(cdp.count).to eq(1), 'not exactly one current dp'
    expect(cdp.first.value_equal_to? 500).to eq(true), 'dp=500 does not remain as current'
    expect(@s.data_points.count).to eq(4), 'not exactly four dps for this series'
  end

  xit %q"should make its 'next of kin' data point current if it's being deleted" do
    ds1 = DataSource.create
    dp = DataPoint.create(
        :series_id => @s.id,
        :date => '2011-03-01',
        :value => 100.0,
        :data_source_id => ds1.id,
        :current => true
    )

    sleep 1
    dp.upd(200, ds1)
    
    expect(@s.data_points.count).to eq(2)
    expect(@s.current_data_points.count).to eq(1)
    
    @s.current_data_points[0].delete

    expect(@s.data_points.count).to eq(1)
    expect(@s.current_data_points.count).to eq(1)
    expect(@s.current_data_points[0].id.to_s).to eq(dp.id.to_s)

    sleep 1  
    dp = DataPoint.where(:current => true).first
    dp2 = dp.upd(300, ds1)
      
    sleep 1
    dp2.upd(400, ds1)

  
    @s.current_data_points[0].delete

    expect(@s.data_points.count).to eq(2)
    expect(@s.current_data_points.count).to eq(1)
    expect(@s.current_data_points[0].id.to_s).to eq(dp2.id.to_s)
  end
end
